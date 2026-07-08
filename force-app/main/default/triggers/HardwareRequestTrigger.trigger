trigger HardwareRequestTrigger on Hardware_Request__c (after insert, after update) {
    if (Trigger.isAfter) {
        HardwareNotificationHandler.handleStatusChange(Trigger.new, Trigger.oldMap);
    }
}
