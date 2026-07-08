public without sharing class HardwareController {
    
    // Hardware Inventory Logic
    @AuraEnabled
    public static List<Hardware__c> getHardwareInventory(String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        try {
            List<Hardware__c> items = [SELECT Id, Name, Type__c, Status__c, Assigned_To__c, Assigned_To__r.Name, Date_Assigned__c, Serial_Number__c, Image_URL__c, Location__c, Year_of_Manufacture__c, Expected_Life_Span_Years__c, OS__c, Life_Span_Consumed_Percentage__c, Username__c, Password__c, Notes__c
                    FROM Hardware__c 
                    ORDER BY CreatedDate DESC];
            for (Hardware__c item : items) {
                if (String.isBlank(item.Image_URL__c)) {
                    item.Image_URL__c = getDefaultImage(item.Type__c);
                }
            }
            return items;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching hardware inventory: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Hardware__c addHardware(String name, String type, String status, String serialNumber, String assignedToId, String location, String imageBase64, Integer yearOfManufacture, Integer expectedLifeSpan, String os, String username, String password, String notes, String callerId) {
        SecurityMiddleware.verifyAdmin(callerId);
        try {
            Hardware__c newHardware = new Hardware__c(
                Name = name,
                Type__c = type,
                Status__c = status,
                Serial_Number__c = serialNumber,
                Location__c = location,
                Year_of_Manufacture__c = yearOfManufacture,
                Expected_Life_Span_Years__c = expectedLifeSpan,
                OS__c = os,
                Username__c = username,
                Password__c = password,
                Notes__c = notes
            );
            
            if (String.isNotBlank(assignedToId)) {
                newHardware.Assigned_To__c = assignedToId;
                newHardware.Date_Assigned__c = Date.today();
                newHardware.Status__c = 'Assigned'; // Override status if assigned
            }
            
            insert newHardware;
            
            // Process Image if provided
            if (String.isNotBlank(imageBase64)) {
                try {
                    String base64Data = imageBase64;
                    if (base64Data.contains(',')) {
                        base64Data = base64Data.substringAfter(',');
                    }
                    
                    ContentVersion cv = new ContentVersion();
                    cv.Title = 'HardwarePic_' + newHardware.Id;
                    cv.PathOnClient = 'HardwarePic_' + newHardware.Id + '.png';
                    cv.VersionData = EncodingUtil.base64Decode(base64Data);
                    cv.IsMajorVersion = true;
                    insert cv;
                    
                    ContentDistribution cd = new ContentDistribution();
                    cd.Name = 'HardwarePic_' + newHardware.Id;
                    cd.ContentVersionId = cv.Id;
                    cd.PreferencesAllowViewInBrowser = true;
                    cd.PreferencesLinkLatestVersion = true;
                    cd.PreferencesNotifyOnVisit = false;
                    cd.PreferencesPasswordRequired = false;
                    cd.PreferencesAllowOriginalDownload = true;
                    insert cd;
                    
                    ContentDistribution dist = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE Id = :cd.Id LIMIT 1];
                    
                    newHardware.Image_URL__c = dist.ContentDownloadUrl;
                    update newHardware;
                } catch (Exception e) {
                    System.debug('Error uploading hardware picture: ' + e.getMessage());
                }
            }
            
            return newHardware;
        } catch (Exception e) {
            throw new AuraHandledException('Error adding hardware: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean assignHardware(String hardwareId, String contactId, String location, String callerId) {
        SecurityMiddleware.verifyAdmin(callerId);
        try {
            Hardware__c hardware = [SELECT Id FROM Hardware__c WHERE Id = :hardwareId LIMIT 1];
            hardware.Assigned_To__c = String.isNotBlank(contactId) ? contactId : null;
            hardware.Date_Assigned__c = String.isNotBlank(contactId) ? Date.today() : null;
            hardware.Status__c = String.isNotBlank(contactId) ? 'Assigned' : 'Available';
            
            if (location != null) {
                hardware.Location__c = location;
            }
            
            update hardware;
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error assigning hardware: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean updateHardware(String hardwareId, String name, String type, String status, String contactId, String location, Integer yearOfManufacture, Integer expectedLifeSpan, String os, String username, String password, String notes, String imageBase64, String callerId) {
        SecurityMiddleware.verifyAdmin(callerId);
        try {
            Hardware__c hardware = [SELECT Id, Image_URL__c FROM Hardware__c WHERE Id = :hardwareId LIMIT 1];
            hardware.Name = name;
            hardware.Type__c = type;
            hardware.Username__c = username;
            hardware.Password__c = password;
            hardware.Location__c = location;
            hardware.Year_of_Manufacture__c = yearOfManufacture;
            hardware.Expected_Life_Span_Years__c = expectedLifeSpan;
            hardware.OS__c = os;
            hardware.Notes__c = notes;

            if (status == 'Under Maintenance' || status == 'Retired') {
                hardware.Status__c = status;
                hardware.Assigned_To__c = null;
                hardware.Date_Assigned__c = null;
            } else {
                hardware.Assigned_To__c = String.isNotBlank(contactId) ? contactId : null;
                hardware.Date_Assigned__c = String.isNotBlank(contactId) ? Date.today() : null;
                hardware.Status__c = String.isNotBlank(contactId) ? 'Assigned' : status;
            }
            
            // Process Image if provided
            if (String.isNotBlank(imageBase64)) {
                try {
                    String base64Data = imageBase64;
                    if (base64Data.contains(',')) {
                        base64Data = base64Data.substringAfter(',');
                    }
                    
                    ContentVersion cv = new ContentVersion();
                    cv.Title = 'HardwarePic_' + hardware.Id;
                    cv.PathOnClient = 'HardwarePic_' + hardware.Id + '.png';
                    cv.VersionData = EncodingUtil.base64Decode(base64Data);
                    cv.IsMajorVersion = true;
                    insert cv;
                    
                    ContentDistribution cd = new ContentDistribution();
                    cd.Name = 'HardwarePic_' + hardware.Id;
                    cd.ContentVersionId = cv.Id;
                    cd.PreferencesAllowViewInBrowser = true;
                    cd.PreferencesLinkLatestVersion = true;
                    cd.PreferencesNotifyOnVisit = false;
                    cd.PreferencesPasswordRequired = false;
                    cd.PreferencesAllowOriginalDownload = true;
                    insert cd;
                    
                    ContentDistribution dist = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE Id = :cd.Id LIMIT 1];
                    hardware.Image_URL__c = dist.ContentDownloadUrl;
                } catch (Exception e) {
                    System.debug('Error uploading hardware picture: ' + e.getMessage());
                }
            }
            
            update hardware;
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating hardware: ' + e.getMessage());
        }
    }

    // Hardware Request Logic
    @AuraEnabled
    public static List<Hardware_Request__c> getHardwareRequests(String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        try {
            return [SELECT Id, Name, Employee__c, Employee__r.Name, Employee__r.Department__c, Employee__r.Position__c, Hardware_Type__c, Description__c, Status__c, CreatedDate, Admin_Comment__c, HR_Manager_Comment__c 
                    FROM Hardware_Request__c 
                    WHERE Is_Ticket__c = false
                    ORDER BY CreatedDate DESC];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching hardware requests: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Hardware_Request__c> getEmployeeHardwareRequests(String contactId) {
        try {
            return [SELECT Id, Name, Employee__c, Employee__r.Name, Employee__r.Department__c, Employee__r.Position__c, Hardware_Type__c, Description__c, Status__c, CreatedDate, Admin_Comment__c, HR_Manager_Comment__c 
                    FROM Hardware_Request__c 
                    WHERE Employee__c = :contactId AND Is_Ticket__c = false
                    ORDER BY CreatedDate DESC];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching employee hardware requests: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Hardware__c> getEmployeeAssignedHardware(String contactId) {
        try {
            List<Hardware__c> items = [SELECT Id, Name, Type__c, Serial_Number__c, Image_URL__c, Date_Assigned__c, Username__c, Password__c 
                    FROM Hardware__c 
                    WHERE Assigned_To__c = :contactId
                    ORDER BY Date_Assigned__c DESC];
            for (Hardware__c item : items) {
                if (String.isBlank(item.Image_URL__c)) {
                    item.Image_URL__c = getDefaultImage(item.Type__c);
                }
            }
            return items;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching assigned hardware: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Hardware_Request__c createHardwareRequest(String contactId, String hardwareType, String description) {
        try {
            Hardware_Request__c request = new Hardware_Request__c(
                Employee__c = contactId,
                Hardware_Type__c = hardwareType,
                Description__c = description,
                Status__c = 'Pending TSA',
                Is_Ticket__c = false
            );
            insert request;
            return request;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating hardware request: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean updateRequestStatus(String requestId, String newStatus, String comment, String role, String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        try {
            Hardware_Request__c request = [SELECT Id FROM Hardware_Request__c WHERE Id = :requestId LIMIT 1];
            request.Status__c = newStatus;
            if (String.isNotBlank(comment)) {
                if (role == 'Admin') {
                    request.Admin_Comment__c = comment;
                } else if (role == 'HRManager') {
                    request.HR_Manager_Comment__c = comment;
                }
            }
            update request;
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating request status: ' + e.getMessage());
        }
    }

    // Ticketing Logic
    @AuraEnabled
    public static List<Hardware_Request__c> getHardwareTickets(String callerId) {
        SecurityMiddleware.verifyAdminOrHROrManager(callerId);
        try {
            return [SELECT Id, Name, Employee__c, Employee__r.Name, Hardware__c, Hardware__r.Name, Status__c, Notes__c, CreatedDate 
                    FROM Hardware_Request__c 
                    WHERE Is_Ticket__c = true
                    ORDER BY CreatedDate DESC];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching tickets: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Hardware_Request__c> getEmployeeHardwareTickets(String contactId) {
        try {
            return [SELECT Id, Name, Hardware__c, Hardware__r.Name, Status__c, Notes__c, CreatedDate 
                    FROM Hardware_Request__c 
                    WHERE Employee__c = :contactId AND Is_Ticket__c = true
                    ORDER BY CreatedDate DESC];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching employee tickets: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Hardware_Request__c createHardwareTicket(String contactId, String hardwareId, String description) {
        try {
            List<Hardware_Request__c> existing = [SELECT Id FROM Hardware_Request__c 
                                                 WHERE Hardware__c = :hardwareId 
                                                 AND Is_Ticket__c = true
                                                 AND Status__c NOT IN ('Solved by Admin', 'Solved by HR/Manager') LIMIT 1];
            if (!existing.isEmpty()) {
                throw new AuraHandledException('There is already an active ticket for this hardware.');
            }
            Hardware_Request__c ticket = new Hardware_Request__c(
                Employee__c = contactId,
                Hardware__c = hardwareId,
                Notes__c = description,
                Status__c = 'Created Ticket',
                Is_Ticket__c = true
            );
            insert ticket;
            return ticket;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteHardwareTicket(String ticketId) {
        try {
            delete [SELECT Id FROM Hardware_Request__c WHERE Id = :ticketId LIMIT 1];
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting ticket: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean updateTicketStatusWithRequest(String ticketId, String newStatus, String comment, String role, Boolean createRequest, String hwType, String callerId) {
        SecurityMiddleware.verifyAdminOrHROrManager(callerId);
        try {
            Hardware_Request__c ticket = [SELECT Id, Employee__c, Notes__c, Name FROM Hardware_Request__c WHERE Id = :ticketId LIMIT 1];
            if (String.isNotBlank(newStatus)) {
                ticket.Status__c = newStatus;
            }
            if (String.isNotBlank(comment)) {
                ticket.Notes__c = comment;
            }
            update ticket;

            if (createRequest && String.isNotBlank(hwType)) {
                Hardware_Request__c req = new Hardware_Request__c(
                    Employee__c = ticket.Employee__c,
                    Hardware_Type__c = hwType,
                    Description__c = 'Created from Ticket ' + ticket.Name + ' (Reason: ' + comment + ')',
                    Status__c = 'Forwarded to HR/Manager',
                    Is_Ticket__c = false
                );
                insert req;
            }
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating ticket: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean updateTicketStatus(String ticketId, String newStatus, String comment, String role, String callerId) {
        return updateTicketStatusWithRequest(ticketId, newStatus, comment, role, false, null, callerId);
    }

    private static String getDefaultImage(String type) {
        if (type == 'Laptop') {
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234a90e2"><path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4v-10z"/></svg>';
        } else if (type == 'Monitor') {
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>';
        } else if (type == 'Mouse') {
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f59e0b"><path d="M12 2C9.24 2 7 4.24 7 7v10c0 2.76 2.24 5 5 5s5-2.24 5-5V7c0-2.76-2.24-5-5-5zm3 15c0 1.66-1.34 3-3 3s-3-1.34-3-3V11h6v6zm0-8h-6V7c0-1.66 1.34-3 3-3s3 1.34 3 3v2z"/></svg>';
        } else if (type == 'Keyboard' || type == 'Keyboard Mouse Combo') {
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238b5cf6"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-3 0h2v2H5v-2zm0-3h2v2H5V8zm11 5H8v-2h8v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>';
        } else if (type == 'Headphones' || type == 'Headset') {
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ec4899"><path d="M12 2c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg>';
        } else if (type == 'Servers' || type == 'CPU') {
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"><path d="M19 15v3c0 .55-.45 1-1 1h-1v-4h2c.55 0 1 .45 1 1zm-8 4h-1v-4h2c.55 0 1 .45 1 1v3c0 .55-.45 1-1 1zm-4 0H5c-.55 0-1-.45-1-1v-3h2c.55 0 1 .45 1 1v3zm11-8v3c0 .55-.45 1-1 1h-1v-4h2c.55 0 1 .45 1 1zm-8 4h-1v-4h2c.55 0 1 .45 1 1v3c0 .55-.45 1-1 1zm-4 0H5c-.55 0-1-.45-1-1v-3h2c.55 0 1 .45 1 1v3zm15-13H3c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 17H4V5h14v14z"/></svg>';
        } else {
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>';
        }
    }

    @AuraEnabled
    public static Boolean deleteHardware(String hardwareId, String callerId) {
        SecurityMiddleware.verifyAdmin(callerId);
        try {
            delete [SELECT Id FROM Hardware__c WHERE Id = :hardwareId LIMIT 1];
            return true;
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting hardware: ' + e.getMessage());
        }
    }
}
