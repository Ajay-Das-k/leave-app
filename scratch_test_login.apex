PaybookLoginController.LoginResult res = PaybookLoginController.authenticateEmployee('CT50', 'Any@1234');
System.debug('Result success: ' + res.success);
System.debug('Result message: ' + res.message);
