try {
    HardwareController.createHardwareTicket(null, null, 'Test issue');
    System.debug('Succeeded in creating ticket with null hardwareId!');
} catch (Exception e) {
    System.debug('Failed with error: ' + e.getTypeName() + ': ' + e.getMessage());
}
