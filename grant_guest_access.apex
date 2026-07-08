// Get Permission Set ID for Leave_app Profile guest user profile
PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'X00ed200000ISg3ZAAT' LIMIT 1];
Id parentId = ps.Id;

// List of class names to grant access to
List<String> classNames = new List<String>{
    'PaybookLoginController',
    'PaybookSignupController',
    'LeaveController',
    'HardwareController',
    'SecurityMiddleware'
};

List<ApexClass> classes = [SELECT Id, Name FROM ApexClass WHERE Name IN :classNames];
List<SetupEntityAccess> accessToInsert = new List<SetupEntityAccess>();

for (ApexClass ac : classes) {
    // Check if access already exists
    List<SetupEntityAccess> existing = [SELECT Id FROM SetupEntityAccess 
                                        WHERE ParentId = :parentId 
                                        AND SetupEntityId = :ac.Id 
                                        LIMIT 1];
    if (existing.isEmpty()) {
        SetupEntityAccess sea = new SetupEntityAccess(
            ParentId = parentId,
            SetupEntityId = ac.Id
        );
        accessToInsert.add(sea);
        System.debug('Adding SetupEntityAccess for class: ' + ac.Name);
    } else {
        System.debug('SetupEntityAccess already exists for class: ' + ac.Name);
    }
}

if (!accessToInsert.isEmpty()) {
    insert accessToInsert;
    System.debug('Successfully inserted ' + accessToInsert.size() + ' SetupEntityAccess records.');
} else {
    System.debug('No new access records needed.');
}
