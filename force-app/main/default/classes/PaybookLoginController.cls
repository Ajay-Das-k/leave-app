public without sharing class PaybookLoginController {
    
    @AuraEnabled
    public static LoginResult authenticateEmployee(String employeeId, String password) {
        LoginResult result = new LoginResult();
        
        try {
            // Search for Contact by Employee_ID__c field
            List<Contact> employees = [SELECT Id, FirstName, LastName, Email, Phone, MobilePhone,
                                              MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry, Address__c, Guardian_Name__c, Guardian_Phone__c, Profile_Picture_URL__c, Blood_Group__c, Guardian_Relation__c,
                                              Department, Department__c, Title, Password_Hash__c, Is_Active__c, Portal_Access_Type__c,
                                              Is_Probation__c, Employee_Type__c, Joining_Date__c, Is_Technical_System_Admin__c
                                       FROM Contact 
                                       WHERE Employee_ID__c = :employeeId 
                                       LIMIT 1];
            
            if (employees.isEmpty()) {
                result.success = false;
                result.message = 'Employee ID not found. Please check your ID.';
                return result;
            }
            
            Contact emp = employees[0];
            
            // Check if employee is active
            if (!emp.Is_Active__c) {
                result.success = false;
                result.message = 'Your account is inactive. Please contact HR.';
                return result;
            }
            
            // Verify password
            if (emp.Password_Hash__c == null || emp.Password_Hash__c != password) {
                result.success = false;
                result.message = 'Invalid password. Please try again.';
                return result;
            }
            
            // Determine user role from Portal_Access_Type__c field
            String userRole = 'Employee'; // Default
            
            if (emp.Portal_Access_Type__c != null) {
                if (emp.Portal_Access_Type__c.contains('Manager')) {
                    userRole = 'Manager';
                } else if (emp.Portal_Access_Type__c.contains('HR')) {
                    userRole = 'HR Admin';
                } else {
                    userRole = 'Employee';
                }
            }
            
            // Return success with user details
            result.success = true;
            result.message = 'Login successful';
            result.userRole = userRole;
            result.contactId = emp.Id;
            result.employeeId = employeeId;
            result.employeeName = emp.FirstName + ' ' + emp.LastName;
            result.firstName = emp.FirstName;
            result.lastName = emp.LastName;
            result.email = emp.Email;
            result.phone = emp.Phone;
            result.mobile = emp.MobilePhone;
            result.title = emp.Title;
            result.department = emp.Department__c;
            result.address = emp.Address__c;
            result.guardianName = emp.Guardian_Name__c;
            result.guardianPhone = emp.Guardian_Phone__c;
            result.guardianRelation = emp.Guardian_Relation__c;
            result.bloodGroup = emp.Blood_Group__c;
            result.profilePictureUrl = emp.Profile_Picture_URL__c;
            
            
            
            result.isProbation = emp.Is_Probation__c;
            result.employeeType = emp.Employee_Type__c;
            result.isTechnicalSystemAdmin = emp.Is_Technical_System_Admin__c;
            
            // Calculate Years of Experience
            if (emp.Joining_Date__c != null) {
                Integer days = emp.Joining_Date__c.daysBetween(System.today());
                if (days < 30) {
                    result.yearsOfExperience = 'New Joiner';
                } else if (days < 365) {
                    Integer months = days / 30;
                    result.yearsOfExperience = months + ' Months';
                } else {
                    Decimal years = Decimal.valueOf(days) / 365.25;
                    result.yearsOfExperience = years.setScale(1) + ' Years';
                }
            } else {
                result.yearsOfExperience = 'N/A';
            }
            
        } catch (Exception e) {
            result.success = false;
            result.message = 'Login error: ' + e.getMessage();
            System.debug('Login Exception: ' + e.getStackTraceString());
        }
        
        return result;
    }
    
    @AuraEnabled
    public static LoginResult getContactDetails(String contactId) {
        LoginResult result = new LoginResult();
        try {
            Contact emp = [SELECT Id, FirstName, LastName, Email, Phone, MobilePhone,
                                  Title, Password_Hash__c, Is_Active__c, Portal_Access_Type__c,
                                  Is_Probation__c, Employee_Type__c, Employee_ID__c,
                                  Joining_Date__c, Gender__c, Birthdate, Department__c, Address__c, Guardian_Name__c, Guardian_Phone__c, Profile_Picture_URL__c, Blood_Group__c, Guardian_Relation__c,
                                  ReportsTo.Name, Is_Technical_System_Admin__c
                           FROM Contact 
                           WHERE Id = :contactId 
                           LIMIT 1];
            
            result.success = true;
            result.contactId = emp.Id;
            result.employeeId = emp.Employee_ID__c;
            result.employeeName = emp.FirstName + ' ' + emp.LastName;
            result.firstName = emp.FirstName;
            result.lastName = emp.LastName;
            result.email = emp.Email;
            result.phone = emp.Phone;
            result.mobile = emp.MobilePhone;
            result.title = emp.Title;
            result.department = emp.Department__c; // Use custom field
            result.address = emp.Address__c;
            result.guardianName = emp.Guardian_Name__c;
            result.guardianPhone = emp.Guardian_Phone__c;
            result.profilePictureUrl = emp.Profile_Picture_URL__c;
            result.bloodGroup = emp.Blood_Group__c;
            result.guardianRelation = emp.Guardian_Relation__c;
            
            result.joiningDate = emp.Joining_Date__c;
            result.gender = emp.Gender__c;
            result.birthdate = emp.Birthdate;
            result.reportsTo = emp.ReportsTo.Name;

            result.isProbation = emp.Is_Probation__c;
            result.employeeType = emp.Employee_Type__c;
            result.isTechnicalSystemAdmin = emp.Is_Technical_System_Admin__c;
            
            // Calculate Years of Experience
            if (emp.Joining_Date__c != null) {
                Integer days = emp.Joining_Date__c.daysBetween(System.today());
                if (days < 30) {
                    result.yearsOfExperience = 'New Joiner';
                } else if (days < 365) {
                    Integer months = days / 30;
                    result.yearsOfExperience = months + ' Months';
                } else {
                    Decimal years = Decimal.valueOf(days) / 365.25;
                    result.yearsOfExperience = years.setScale(1) + ' Years';
                }
            } else {
                result.yearsOfExperience = 'N/A';
            }
            
            // Determine role again just in case
            String userRole = 'Employee'; 
            if (emp.Portal_Access_Type__c != null) {
                if (emp.Portal_Access_Type__c.contains('Manager')) {
                    userRole = 'Manager';
                } else if (emp.Portal_Access_Type__c.contains('HR')) {
                    userRole = 'HR Admin';
                }
            }
            result.userRole = userRole;
            
        } catch (Exception e) {
            result.success = false;
            result.message = 'Error fetching details: ' + e.getMessage();
        }
        return result;
    }
    
    @AuraEnabled
    public static Boolean updateEmployeeProfile(String contactId, Map<String, Object> updates) {
        try {
            Contact emp = [SELECT Id FROM Contact WHERE Id = :contactId LIMIT 1];
            
            if (updates.containsKey('email')) emp.Email = (String)updates.get('email');
            if (updates.containsKey('phone')) emp.Phone = (String)updates.get('phone');
            if (updates.containsKey('mobile')) emp.MobilePhone = (String)updates.get('mobile');
            if (updates.containsKey('address')) emp.Address__c = (String)updates.get('address');
            if (updates.containsKey('guardianName')) emp.Guardian_Name__c = (String)updates.get('guardianName');
            if (updates.containsKey('guardianPhone')) emp.Guardian_Phone__c = (String)updates.get('guardianPhone');
            if (updates.containsKey('bloodGroup')) emp.Blood_Group__c = (String)updates.get('bloodGroup');
            if (updates.containsKey('guardianRelation')) emp.Guardian_Relation__c = (String)updates.get('guardianRelation');
            if (updates.containsKey('password')) {
                String newPass = (String)updates.get('password');
                if (String.isNotBlank(newPass)) {
                    emp.Password_Hash__c = newPass;
                }
            }
            
            update emp;
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating profile: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean generateResetOTP(String employeeId, String email) {
        try {
            List<Contact> employees = [SELECT Id FROM Contact 
                                     WHERE Employee_ID__c = :employeeId 
                                     AND Email = :email 
                                     LIMIT 1];
            
            if (employees.isEmpty()) {
                return false;
            }
            
            Contact emp = employees[0];
            
            // Generate 6-digit OTP
            String otp = String.valueOf(Math.abs(Crypto.getRandomInteger())).left(6);
            if (otp.length() < 6) {
                otp = otp.leftPad(6, '0');
            }
            
            emp.Reset_OTP__c = otp;
            // No time limit requested
            update emp;
            
            // Send Email with OTP
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            mail.setToAddresses(new String[] {email});
            mail.setSubject('Your Password Reset OTP');
            mail.setHtmlBody('<p>Dear Employee,</p><p>Your OTP for password reset is: <b>' + otp + '</b></p><p>This OTP will expire in 3 minutes.</p>');
            Messaging.sendEmail(new Messaging.SingleEmailMessage[] {mail});
            
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error generating OTP: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean resetPassword(String employeeId, String email, String otp, String newPassword) {
        try {
            List<Contact> employees = [SELECT Id, Reset_OTP__c, Reset_OTP_Expiry__c FROM Contact 
                                     WHERE Employee_ID__c = :employeeId 
                                     AND Email = :email 
                                     LIMIT 1];
            
            if (employees.isEmpty()) {
                throw new AuraHandledException('Invalid Employee ID or Email.');
            }
            
            Contact emp = employees[0];
            
            // Verify OTP
            if (String.isBlank(emp.Reset_OTP__c) || emp.Reset_OTP__c != otp) {
                throw new AuraHandledException('Invalid OTP.');
            }
            
            // No time limit check required
            
            // Password Sanitization (at least 8 chars, 1 number, 1 letter)
            Pattern pwdPattern = Pattern.compile('^(?=.*[A-Za-z])(?=.*\\d).{8,}$');
            Matcher pwdMatcher = pwdPattern.matcher(newPassword);
            if (!pwdMatcher.matches()) {
                throw new AuraHandledException('Password must be at least 8 characters long and contain at least one letter and one number.');
            }
            
            emp.Password_Hash__c = newPassword;
            emp.Reset_OTP__c = null;
            emp.Reset_OTP_Expiry__c = null;
            update emp;
            
            return true;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    @AuraEnabled
    public static LoginResult changeDefaultPassword(String employeeId, String newPassword) {
        try {
            List<Contact> employees = [SELECT Id, Password_Hash__c FROM Contact WHERE Employee_ID__c = :employeeId LIMIT 1];
            if (employees.isEmpty()) throw new AuraHandledException('Employee not found.');
            
            Contact emp = employees[0];
            if (emp.Password_Hash__c != 'WELCOME@CRMantra12') {
                throw new AuraHandledException('Password has already been changed from default.');
            }
            
            // Password Sanitization (at least 8 chars, 1 number, 1 letter)
            Pattern pwdPattern = Pattern.compile('^(?=.*[A-Za-z])(?=.*\\d).{8,}$');
            Matcher pwdMatcher = pwdPattern.matcher(newPassword);
            if (!pwdMatcher.matches()) {
                throw new AuraHandledException('Password must be at least 8 characters long and contain at least one letter and one number.');
            }
            
            emp.Password_Hash__c = newPassword;
            update emp;
            
            return authenticateEmployee(employeeId, newPassword);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    @AuraEnabled
    public static String uploadProfilePicture(String contactId, String base64Data, String fileName, String contentType) {
        try {
            // Create ContentVersion
            ContentVersion cv = new ContentVersion();
            cv.Title = fileName;
            cv.PathOnClient = fileName;
            cv.VersionData = EncodingUtil.base64Decode(base64Data);
            cv.IsMajorVersion = true;
            insert cv;
            
            // Get ContentDocumentId
            Id conDocId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id =:cv.Id LIMIT 1].ContentDocumentId;
            
            // Create ContentDocumentLink
            ContentDocumentLink cdl = new ContentDocumentLink();
            cdl.ContentDocumentId = conDocId;
            cdl.LinkedEntityId = contactId;
            cdl.ShareType = 'I';
            cdl.Visibility = 'AllUsers';
            insert cdl;
            
            // Create Public Link via ContentDistribution
            ContentDistribution cd = new ContentDistribution();
            cd.Name = fileName;
            cd.ContentVersionId = cv.Id;
            cd.PreferencesAllowViewInBrowser = true;
            cd.PreferencesLinkLatestVersion = true;
            cd.PreferencesNotifyOnVisit = false;
            cd.PreferencesPasswordRequired = false;
            cd.PreferencesAllowOriginalDownload = true;
            insert cd;
            
            // Query the generated public URL
            ContentDistribution insertedCd = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE Id = :cd.Id LIMIT 1];
            String picUrl = insertedCd.ContentDownloadUrl;
            
            // Update Contact Profile_Picture_URL__c
            Contact emp = new Contact(Id = contactId);
            emp.Profile_Picture_URL__c = picUrl;
            update emp;
            
            return picUrl;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Contact> getAllEmployees(String callerId) {
        try {
            SecurityMiddleware.verifyAdminOrHR(callerId);
            return [SELECT Id, FirstName, LastName, Name, Email, Phone, MobilePhone, Employee_ID__c,
                           Department__c, Title, Is_Active__c, Portal_Access_Type__c,
                           Is_Probation__c, Employee_Type__c, Joining_Date__c, Gender__c, Birthdate,
                           Address__c, Guardian_Name__c, Guardian_Phone__c, Profile_Picture_URL__c, Blood_Group__c, Guardian_Relation__c,
                           Position__c, ReportsTo.Name, Is_Technical_System_Admin__c
                    FROM Contact
                    ORDER BY Name ASC];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean toggleEmployeeStatus(String contactId, Boolean isActive, String callerId) {
        try {
            SecurityMiddleware.verifyAdminOrHR(callerId);
            Contact emp = new Contact(Id = contactId, Is_Active__c = isActive);
            update emp;
            return true;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean makeEmployeePermanent(String contactId, String callerId) {
        try {
            SecurityMiddleware.verifyAdminOrHR(callerId);
            Contact empToUpdate = new Contact(Id = contactId, Employee_Type__c = 'Permanent');
            update empToUpdate;
            
            // Send Congratulation Email
            Contact empDetails = [SELECT Id, FirstName, Email FROM Contact WHERE Id = :contactId LIMIT 1];
            if (String.isNotBlank(empDetails.Email)) {
                Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
                mail.setToAddresses(new String[] { empDetails.Email });
                mail.setSubject('Congratulations on your Confirmation!');
                
                String body = 'Dear ' + (String.isNotBlank(empDetails.FirstName) ? empDetails.FirstName : 'Employee') + ',\n\n' +
                              'Congratulations! We are thrilled to inform you that you have successfully completed your probation period and your employment is now confirmed as Permanent.\n\n' +
                              'We are excited to have you as a permanent member of our team and look forward to your continued growth and contributions.\n\n' +
                              'Best Regards,\nHR Team';
                
                mail.setPlainTextBody(body);
                Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
            }
            
            return true;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean updateEmployeePosition(String contactId, String newPositions, Boolean isTechnicalSystemAdmin, String callerId) {
        try {
            SecurityMiddleware.verifyAdminOrHR(callerId);
            Contact empDetails = [SELECT Id, FirstName, Email, Position__c, Is_Technical_System_Admin__c FROM Contact WHERE Id = :contactId LIMIT 1];
            String oldPositions = empDetails.Position__c;
            Boolean oldTsa = empDetails.Is_Technical_System_Admin__c;
            
            // Only update if it actually changed
            if (oldPositions != newPositions || oldTsa != isTechnicalSystemAdmin) {
                empDetails.Position__c = newPositions;
                empDetails.Is_Technical_System_Admin__c = isTechnicalSystemAdmin;
                update empDetails;
                
                // Send Congratulation Email for Position Change
                if (String.isNotBlank(empDetails.Email)) {
                    Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
                    mail.setTargetObjectId(empDetails.Id);
                    mail.setSaveAsActivity(false);
                    mail.setSubject('Congratulations on your new Role(s)!');
                    
                    List<OrgWideEmailAddress> owaList = [SELECT Id FROM OrgWideEmailAddress WHERE IsVerified = true LIMIT 1];
                    if (!owaList.isEmpty()) {
                        mail.setOrgWideEmailAddressId(owaList[0].Id);
                    }
                    
                    String formattedRoles = String.isNotBlank(newPositions) ? newPositions.replaceAll(';', ', ') : 'No roles assigned';
                    
                    String body = 'Dear ' + (String.isNotBlank(empDetails.FirstName) ? empDetails.FirstName : 'Employee') + ',\n\n' +
                                  'Congratulations! Your positions/roles have been updated successfully.\n\n' +
                                  'Your new roles are: ' + formattedRoles + '\n\n' +
                                  'We wish you all the best in your responsibilities!\n\n' +
                                  'Best Regards,\nHR Team';
                    
                    mail.setPlainTextBody(body);
                    Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
                }
            }
            
            return true;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    public class LoginResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public String userRole;
        @AuraEnabled public String contactId;
        @AuraEnabled public String employeeId;
        @AuraEnabled public String employeeName;
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String mobile;
        @AuraEnabled public String title;
        @AuraEnabled public String department;
        @AuraEnabled public Date joiningDate;
        @AuraEnabled public String gender;
        @AuraEnabled public Date birthdate;
        @AuraEnabled public String reportsTo;
        @AuraEnabled public Boolean isProbation;
        @AuraEnabled public String employeeType;
        @AuraEnabled public String yearsOfExperience;
        @AuraEnabled public String address;
        @AuraEnabled public String guardianName;
        @AuraEnabled public String guardianPhone;
        @AuraEnabled public String guardianRelation;
        @AuraEnabled public String bloodGroup;
        @AuraEnabled public String profilePictureUrl;
        @AuraEnabled public String position;
        @AuraEnabled public Boolean isTechnicalSystemAdmin;
    }
}