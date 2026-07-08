List<String> permSets = new List<String>{'Employee_Access', 'Manager_Access', 'HR_Access', 'System_Admin_Access'};
List<String> hardwareFields = new List<String>{'Year_of_Manufacture__c', 'OS__c', 'Expected_Life_Span_Years__c', 'Life_Span_Consumed_Percentage__c'};
List<String> contactFields = new List<String>{'Blood_Group__c', 'Guardian_Relation__c'};

List<FieldPermissions> newFls = new List<FieldPermissions>();
List<PermissionSet> psList = [SELECT Id, Name FROM PermissionSet WHERE Name IN :permSets];

for (PermissionSet ps : psList) {
    for (String field : hardwareFields) {
        newFls.add(new FieldPermissions(
            ParentId = ps.Id,
            SobjectType = 'Hardware__c',
            Field = 'Hardware__c.' + field,
            PermissionsEdit = (field != 'Life_Span_Consumed_Percentage__c'),
            PermissionsRead = true
        ));
    }
    for (String field : contactFields) {
        newFls.add(new FieldPermissions(
            ParentId = ps.Id,
            SobjectType = 'Contact',
            Field = 'Contact.' + field,
            PermissionsEdit = true,
            PermissionsRead = true
        ));
    }
}
insert newFls;
