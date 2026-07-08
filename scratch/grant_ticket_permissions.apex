List<String> permSets = new List<String>{'Employee_Access', 'Manager_Access', 'HR_Access', 'System_Admin_Access'};
List<PermissionSet> psList = [SELECT Id, Name FROM PermissionSet WHERE Name IN :permSets];

List<FieldPermissions> newFps = new List<FieldPermissions>();
List<String> requestFields = new List<String>{'Is_Ticket__c', 'Hardware__c', 'Notes__c'};

for (PermissionSet ps : psList) {
    // Add FieldPermissions
    for (String f : requestFields) {
        newFps.add(new FieldPermissions(
            ParentId = ps.Id,
            SobjectType = 'Hardware_Request__c',
            Field = 'Hardware_Request__c.' + f,
            PermissionsRead = true,
            PermissionsEdit = true
        ));
    }
}

try {
    insert newFps;
    System.debug('Inserted FieldPermissions for Hardware_Request__c custom fields successfully.');
} catch (Exception e) {
    System.debug('FPS insert failed: ' + e.getMessage());
}
