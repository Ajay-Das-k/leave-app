public without sharing class PaybookSignupController {
    
    @AuraEnabled
    public static SignupResult registerEmployee(String firstName, String lastName, String email, 
                                                 String employeeId, String password, String confirmPassword,
                                                 String department, String employeeType, String joiningDate,
                                                 String gender, String mobile, String birthdate,
                                                 String workLocation, String profilePicBase64) {
        SignupResult result = new SignupResult();
        
        try {
            
            // Validation - ALL REQUIRED (including new critical ones)
            if (String.isBlank(firstName) || String.isBlank(lastName) || String.isBlank(email) || 
                String.isBlank(employeeId) || String.isBlank(password) || String.isBlank(employeeType) ||
                String.isBlank(joiningDate) || String.isBlank(gender)) {
                result.success = false;
                result.message = 'Please fill all required fields (Gender is required for Maternity logic)';
                return result;
            }
            
            // Password validation
            if (password.length() < 6) {
                result.success = false;
                result.message = 'Password must be at least 6 characters';
                return result;
            }
            
            if (password != confirmPassword) {
                result.success = false;
                result.message = 'Passwords do not match';
                return result;
            }
            
            // Check if Employee ID already exists
            List<Contact> existingContacts = [SELECT Id FROM Contact 
                                              WHERE Employee_ID__c = :employeeId LIMIT 1];
            
            if (!existingContacts.isEmpty()) {
                result.success = false;
                result.message = 'Employee ID already registered. Please login instead.';
                return result;
            }
            
            // Check if Email already exists
            List<Contact> emailCheck = [SELECT Id FROM Contact WHERE Email = :email LIMIT 1];
            
            if (!emailCheck.isEmpty()) {
                result.success = false;
                result.message = 'Email already registered. Please login instead.';
                return result;
            }

            // Validate Employee Type (picklist values)
            List<String> validEmployeeTypes = new List<String>{'Permanent', 'Probation'};
            if (!validEmployeeTypes.contains(employeeType)) {
                result.success = false;
                result.message = 'Invalid Employee Type selected';
                return result;
            }
            
            // Validate and parse dates
            Date joiningDateObj;
            Date birthdateObj;
            try {
                joiningDateObj = Date.valueOf(joiningDate);
                if (String.isNotBlank(birthdate)) {
                    birthdateObj = Date.valueOf(birthdate);
                }
            } catch (Exception e) {
                result.success = false;
                result.message = 'Invalid date format';
                return result;
            }
            
            // Create new Contact record with REQUIRED fields
            Contact newContact = new Contact(
                FirstName = firstName,
                LastName = lastName,
                Email = email,
                Employee_ID__c = employeeId,
                Password_Hash__c = password,
                Is_Active__c = true,
                Portal_Access_Type__c = 'Employee',
                Department__c = String.isNotBlank(department) ? department : null,
                Employee_Type__c = employeeType,
                Joining_Date__c = joiningDateObj,
                
                // New Fields
                Gender__c = gender, // Assumed Custom Field based on context
                MobilePhone = mobile,
                Birthdate = birthdateObj,
                Work_Location__c = workLocation,
                ReportsToId = null, // Manager assignment removed from signup form
                
                // Default Grants (User requested "Identify who can app leave")
                // Assuming defaults are TRUE for everyone initially
                Can_Apply_Casual__c = true,
                Can_Apply_Sick__c = true,
                Can_Apply_Marriage__c = true,
                Can_Apply_Bereavement__c = true
                // Can_Apply_Maternity__c is calculated formula
            );
            
            insert newContact;
            
            // Process Profile Picture if provided
            if (String.isNotBlank(profilePicBase64)) {
                try {
                    String base64Data = profilePicBase64;
                    if (base64Data.contains(',')) {
                        base64Data = base64Data.substringAfter(',');
                    }
                    
                    ContentVersion cv = new ContentVersion();
                    cv.Title = 'ProfilePic_' + employeeId;
                    cv.PathOnClient = 'ProfilePic_' + employeeId + '.png';
                    cv.VersionData = EncodingUtil.base64Decode(base64Data);
                    cv.IsMajorVersion = true;
                    insert cv;
                    
                    ContentDistribution cd = new ContentDistribution();
                    cd.Name = 'ProfilePic_' + employeeId;
                    cd.ContentVersionId = cv.Id;
                    cd.PreferencesAllowViewInBrowser = true;
                    cd.PreferencesLinkLatestVersion = true;
                    cd.PreferencesNotifyOnVisit = false;
                    cd.PreferencesPasswordRequired = false;
                    cd.PreferencesAllowOriginalDownload = true;
                    insert cd;
                    
                    ContentDistribution dist = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE Id = :cd.Id LIMIT 1];
                    
                    newContact.Profile_Picture_URL__c = dist.ContentDownloadUrl;
                    update newContact;
                } catch (Exception e) {
                    System.debug('Error uploading profile picture: ' + e.getMessage());
                }
            }
            
            // Assign default leave balances
            List<Leave_Type__c> leaveTypes = [SELECT Id, Name FROM Leave_Type__c WHERE Is_Active__c = true];
            List<Leave_Balance__c> balancesToInsert = new List<Leave_Balance__c>();
            
            for (Leave_Type__c lt : leaveTypes) {
                Decimal defaultBalance = 0;
                String typeName = lt.Name;
                
                if (typeName.containsIgnoreCase('Annual') || typeName.containsIgnoreCase('Earned')) {
                    defaultBalance = 20;
                } else if (typeName.containsIgnoreCase('Casual')) {
                    if (String.isNotBlank(employeeType) && employeeType.equalsIgnoreCase('Probation')) {
                        defaultBalance = 0;
                    } else {
                        defaultBalance = 12;
                    }
                } else if (typeName.containsIgnoreCase('Sick')) {
                    defaultBalance = 6;
                } else if (typeName.containsIgnoreCase('Maternity')) {
                    defaultBalance = (String.isNotBlank(gender) && gender.equalsIgnoreCase('Female')) ? 180 : 0;
                } else if (typeName.containsIgnoreCase('Paternity')) {
                    defaultBalance = (String.isNotBlank(gender) && gender.equalsIgnoreCase('Male')) ? 5 : 0;
                } else if (typeName.containsIgnoreCase('Bereavement')) {
                    defaultBalance = 5;
                }
                
                // Do not create balance record if 0 for gender-specific leaves? 
                // Better to create with 0 so they see it but can't use it (or validation blocks it).
                
                balancesToInsert.add(new Leave_Balance__c(
                    Employee__c = newContact.Id,
                    Leave_Type__c = lt.Id,
                    Opening_Balance__c = defaultBalance,
                    Used__c = 0,
                    Year__c = System.today().year(),
                    Pending__c = 0,
                    Carried_Forward__c = 0,
                    Status__c = 'Active'
                ));
            }

            
            if (!balancesToInsert.isEmpty()) {
                insert balancesToInsert;
            }
            
            result.success = true;
            result.message = 'Account created successfully! Please login.';
            result.contactId = newContact.Id;
            
        } catch (DmlException e) {
            result.success = false;
            result.message = 'Error creating account: ' + e.getMessage();
            System.debug('Signup Error: ' + e.getStackTraceString());
        } catch (Exception e) {
            result.success = false;
            result.message = 'An error occurred: ' + e.getMessage();
            System.debug('Exception: ' + e.getStackTraceString());
        }
        
        return result;
    }

    @AuraEnabled
    public static SignupResult addEmployee(String firstName, String lastName, String email, 
                                            String employeeId, String department, String employeeType, 
                                            String joiningDate, String gender, String mobile, 
                                            String birthdate, String managerId, Boolean isManager, 
                                            Boolean isHrAdmin, String position, Boolean isTechnicalSystemAdmin,
                                            String callerId) {
        SignupResult result = new SignupResult();
        
        try {
            SecurityMiddleware.verifyAdminOrHR(callerId);
            // Validation
            if (String.isBlank(firstName) || String.isBlank(lastName) || String.isBlank(email) || 
                String.isBlank(employeeId) || String.isBlank(employeeType) ||
                String.isBlank(joiningDate) || String.isBlank(gender)) {
                result.success = false;
                result.message = 'Please fill all required fields';
                return result;
            }
            
            // Check if Employee ID already exists
            List<Contact> existingContacts = [SELECT Id FROM Contact WHERE Employee_ID__c = :employeeId LIMIT 1];
            if (!existingContacts.isEmpty()) {
                result.success = false;
                result.message = 'Employee ID already registered';
                return result;
            }
            
            // Check if Email already exists
            List<Contact> emailCheck = [SELECT Id FROM Contact WHERE Email = :email LIMIT 1];
            if (!emailCheck.isEmpty()) {
                result.success = false;
                result.message = 'Email already registered';
                return result;
            }
            
            // Parse dates
            Date joiningDateObj = Date.valueOf(joiningDate);
            Date birthdateObj = String.isNotBlank(birthdate) ? Date.valueOf(birthdate) : null;
            
            // Create new Contact record
            Contact newContact = new Contact(
                FirstName = firstName,
                LastName = lastName,
                Email = email,
                Employee_ID__c = employeeId,
                Password_Hash__c = 'WELCOME@CRMantra12',
                Is_Active__c = true,
                Portal_Access_Type__c = isHrAdmin ? 'HR Admin' : (isManager ? 'Manager' : 'Employee'),
                Is_Manager__c = isManager,
                Is_HR_Admin__c = isHrAdmin,
                Is_Technical_System_Admin__c = isTechnicalSystemAdmin != null ? isTechnicalSystemAdmin : false,
                Department__c = String.isNotBlank(department) ? department : null,
                Employee_Type__c = employeeType,
                Joining_Date__c = joiningDateObj,
                Gender__c = gender,
                MobilePhone = mobile,
                Birthdate = birthdateObj,
                ReportsToId = String.isNotBlank(managerId) ? Id.valueOf(managerId) : null,
                Reporting_Manager__c = String.isNotBlank(managerId) ? Id.valueOf(managerId) : null,
                Position__c = String.isNotBlank(position) ? position : null,
                Can_Apply_Casual__c = true,
                Can_Apply_Sick__c = true,
                Can_Apply_Marriage__c = true,
                Can_Apply_Bereavement__c = true
            );
            
            insert newContact;
            
            // Assign default leave balances
            List<Leave_Type__c> leaveTypes = [SELECT Id, Name FROM Leave_Type__c WHERE Is_Active__c = true];
            List<Leave_Balance__c> balancesToInsert = new List<Leave_Balance__c>();
            
            for (Leave_Type__c lt : leaveTypes) {
                Decimal defaultBalance = 0;
                String typeName = lt.Name;
                
                if (typeName.containsIgnoreCase('Annual') || typeName.containsIgnoreCase('Earned')) {
                    defaultBalance = 20;
                } else if (typeName.containsIgnoreCase('Casual')) {
                    if (String.isNotBlank(employeeType) && employeeType.equalsIgnoreCase('Probation')) {
                        defaultBalance = 0;
                    } else {
                        defaultBalance = 12;
                    }
                } else if (typeName.containsIgnoreCase('Sick')) {
                    defaultBalance = 6;
                } else if (typeName.containsIgnoreCase('Maternity')) {
                    defaultBalance = (String.isNotBlank(gender) && gender.equalsIgnoreCase('Female')) ? 180 : 0;
                } else if (typeName.containsIgnoreCase('Paternity')) {
                    defaultBalance = (String.isNotBlank(gender) && gender.equalsIgnoreCase('Male')) ? 5 : 0;
                } else if (typeName.containsIgnoreCase('Bereavement')) {
                    defaultBalance = 5;
                }
                
                balancesToInsert.add(new Leave_Balance__c(
                    Employee__c = newContact.Id,
                    Leave_Type__c = lt.Id,
                    Opening_Balance__c = defaultBalance,
                    Used__c = 0,
                    Year__c = System.today().year(),
                    Pending__c = 0,
                    Carried_Forward__c = 0,
                    Status__c = 'Active'
                ));
            }
            
            if (!balancesToInsert.isEmpty()) {
                insert balancesToInsert;
            }
            
            // Send welcome email
            try {
                Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
                mail.setToAddresses(new String[] { email });
                mail.setSubject('Welcome to Leave App - Your Account Details');
                
                String body = 'Dear ' + firstName + ',\n\n' +
                    'Welcome to the Leave Management Application.\n\n' +
                    'Your employee portal account has been created. Here are your credentials to log in:\n' +
                    'Employee ID: ' + employeeId + '\n' +
                    'Initial Password: WELCOME@CRMantra12\n\n' +
                    'Please log in using your Employee ID and change your password immediately upon your first login.\n\n' +
                    'Link: https://ajaytesting-dev-ed.develop.my.site.com/vforcesite \n\n' +
                    'Regards,\nLeave Management Team';
                    
                mail.setPlainTextBody(body);
                Messaging.sendEmail(new List<Messaging.SingleEmailMessage> { mail });
            } catch (Exception emailEx) {
                System.debug('Email could not be sent: ' + emailEx.getMessage());
                result.message = 'Account created successfully, but welcome email could not be sent: ' + emailEx.getMessage();
                result.success = true;
                result.contactId = newContact.Id;
                return result;
            }
            
            result.success = true;
            result.message = 'Employee created successfully and welcome email sent!';
            result.contactId = newContact.Id;
            
        } catch (Exception e) {
            result.success = false;
            result.message = 'Error creating employee: ' + e.getMessage();
            System.debug('Add Employee Error: ' + e.getStackTraceString());
        }
        
        return result;
    }
    
    public class SignupResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public String contactId;
    }
}