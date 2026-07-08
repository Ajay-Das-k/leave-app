try {
    Hardware__c hardware = [SELECT Id, Image_URL__c FROM Hardware__c LIMIT 1];
    String base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    String base64Data = base64Image;
    if (base64Data.contains(',')) {
        base64Data = base64Data.substringAfter(',');
    }
    
    ContentVersion cv = new ContentVersion();
    cv.Title = 'HardwarePic_' + hardware.Id;
    cv.PathOnClient = 'HardwarePic_' + hardware.Id + '.png';
    cv.VersionData = EncodingUtil.base64Decode(base64Data);
    cv.IsMajorVersion = true;
    insert cv;
    System.debug('Inserted ContentVersion: ' + cv.Id);
    
    ContentDistribution cd = new ContentDistribution();
    cd.Name = 'HardwarePic_' + hardware.Id;
    cd.ContentVersionId = cv.Id;
    cd.PreferencesAllowViewInBrowser = true;
    cd.PreferencesLinkLatestVersion = true;
    cd.PreferencesNotifyOnVisit = false;
    cd.PreferencesPasswordRequired = false;
    cd.PreferencesAllowOriginalDownload = true;
    insert cd;
    System.debug('Inserted ContentDistribution: ' + cd.Id);
    
    ContentDistribution dist = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE Id = :cd.Id LIMIT 1];
    System.debug('ContentDownloadUrl: ' + dist.ContentDownloadUrl);
} catch (Exception e) {
    System.debug('Error occurred: ' + e.getMessage() + '\nStack: ' + e.getStackTraceString());
}
