public without sharing class LeaveController {
    
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getPendingLeaves(String callerId) {
        SecurityMiddleware.verifyAdminOrHROrManager(callerId);
        return [SELECT Id, Name, Employee__c, Employee__r.Name, Employee__r.Profile_Picture_URL__c, Status__c, Leave_Type__c, Leave_Type__r.Name, Reason__c, Submitted_Date__c, From_Date__c, To_Date__c
                FROM Leave_Request__c 
                WHERE Status__c IN ('Submitted', 'Cancellation Requested') 
                ORDER BY Submitted_Date__c DESC LIMIT 50];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getHRColleagueLeaves(String hrId) {
        SecurityMiddleware.verifyHR(hrId);
        // If hrId is provided, exclude their own leaves to prevent self-approval
        if (String.isNotBlank(hrId)) {
            return [SELECT Id, Name, Employee__c, Employee__r.Name, Employee__r.Profile_Picture_URL__c, Status__c, Leave_Type__c, Leave_Type__r.Name, Reason__c, Submitted_Date__c, From_Date__c, To_Date__c, Number_of_Days__c
                    FROM Leave_Request__c 
                    WHERE Status__c IN ('Submitted', 'Pending HR Approval', 'Cancellation Requested') 
                    AND Employee__c != :hrId
                    ORDER BY Submitted_Date__c DESC LIMIT 50];
        } else {
            return [SELECT Id, Name, Employee__c, Employee__r.Name, Employee__r.Profile_Picture_URL__c, Status__c, Leave_Type__c, Leave_Type__r.Name, Reason__c, Submitted_Date__c, From_Date__c, To_Date__c, Number_of_Days__c
                    FROM Leave_Request__c 
                    WHERE Status__c IN ('Submitted', 'Pending HR Approval', 'Cancellation Requested') 
                    ORDER BY Submitted_Date__c DESC LIMIT 50];
        }
    }

    @AuraEnabled
    public static void approveLeaveRequest(Id leaveId, String comment, String managerId) {
        SecurityMiddleware.verifyManager(managerId);
        finalizeApproval(leaveId, comment);
    }


    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getManagerStats(String managerId) {
        SecurityMiddleware.verifyManager(managerId);
        Map<String, Integer> stats = new Map<String, Integer>();
        
        // 1. Pending Approvals
        stats.put('pendingCount', [SELECT Count() FROM Leave_Request__c WHERE Status__c = 'Submitted']);
        
        // 2. Team On Leave Today (Approved status + Today is between Start and End)
        stats.put('teamOnLeaveCount', [SELECT Count() FROM Leave_Request__c 
                                       WHERE Status__c = 'HR_Approved' 
                                       AND From_Date__c <= :Date.today() 
                                       AND To_Date__c >= :Date.today()]);
                                       
        // 3. Approved This Month
        stats.put('approvedCount', [SELECT Count() FROM Leave_Request__c 
                                    WHERE Status__c = 'HR_Approved' 
                                    AND CALENDAR_MONTH(Submitted_Date__c) = :Date.today().month() 
                                    AND CALENDAR_YEAR(Submitted_Date__c) = :Date.today().year()]);
                                    
        // 4. Rejected This Month
        stats.put('rejectedCount', [SELECT Count() FROM Leave_Request__c 
                                    WHERE Status__c LIKE '%Rejected' 
                                    AND CALENDAR_MONTH(Submitted_Date__c) = :Date.today().month() 
                                    AND CALENDAR_YEAR(Submitted_Date__c) = :Date.today().year()]);
                                    
        // 5. Cancelled This Month
        stats.put('cancelledCount', [SELECT Count() FROM Leave_Request__c 
                                    WHERE Status__c = 'Cancelled' 
                                    AND CALENDAR_MONTH(Submitted_Date__c) = :Date.today().month() 
                                    AND CALENDAR_YEAR(Submitted_Date__c) = :Date.today().year()]);

        return stats;
    }
    
    @AuraEnabled
    public static void approveLeaveByHR(Id leaveId, String comment, String hrId) {
        SecurityMiddleware.verifyHR(hrId);
        finalizeApproval(leaveId, comment);
    }

    @AuraEnabled
    public static void rejectLeaveRequest(Id leaveId, String comment, String callerId) {
        SecurityMiddleware.verifyAdminOrHROrManager(callerId);
        try {
            Leave_Request__c leaveReq = [SELECT Id FROM Leave_Request__c WHERE Id = :leaveId LIMIT 1];
            leaveReq.Status__c = 'HR_Rejected';
            if (String.isNotBlank(comment)) {
                leaveReq.Manager_Approval_Comment__c = comment;
            }
            update leaveReq;
        } catch (Exception e) {
            throw new AuraHandledException('Error rejecting leave: ' + e.getMessage());
        }
    }


    @AuraEnabled
    public static void submitPartialCancellation(Id originalLeaveId, Date newEndDate, Boolean isHalfDay) {
        try {
            Leave_Request__c originalLeave = [SELECT Id, Employee__c, Leave_Type__c, Leave_Type__r.Name, 
                                                     From_Date__c, To_Date__c, Reason__c, Status__c 
                                              FROM Leave_Request__c 
                                              WHERE Id = :originalLeaveId LIMIT 1];

            // Validate
            if (originalLeave.Status__c != 'HR_Approved' && originalLeave.Status__c != 'Approved') {
                throw new AuraHandledException('Only approved leaves can be partially cancelled.');
            }
            if (newEndDate < originalLeave.From_Date__c || newEndDate > originalLeave.To_Date__c) { // Changed >= to > to allow selecting ToDate for HalfDay
                throw new AuraHandledException('Invalid New End Date. Must be within the original leave range.');
            }
            
            // Logic 1: Cancel Days AFTER the New End Date (Truncate)
            if (newEndDate < originalLeave.To_Date__c) {
                Date cancelFromDate = newEndDate.addDays(1);
                Date cancelToDate = originalLeave.To_Date__c;

                Leave_Request__c cancelReq = new Leave_Request__c(
                    Employee__c = originalLeave.Employee__c,
                    Leave_Type__c = originalLeave.Leave_Type__c,
                    From_Date__c = cancelFromDate,
                    To_Date__c = cancelToDate,
                    Reason__c = 'Partial Cancellation for: ' + originalLeave.Reason__c,
                    Status__c = 'Cancellation Requested',
                    Submitted_Date__c = Date.today(),
                    Name = 'CN-' + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 6)
                );
                insert cancelReq;
            }

            // Logic 2: Convert the New End Date to Half Day
            if (isHalfDay != null && isHalfDay) {
                // Check if already Half Day
                if (originalLeave.Reason__c != null && originalLeave.Reason__c.contains('(Half Day)')) {
                    // If shortening a Half Day leave, we don't need to do anything extra for the last day, it stays Half Day.
                    // But if this is a Full Day leave becoming Half Day...
                } else {
                    // Create a request specifically for converting this day to Half Day
                    // We mark this with a specific reason pattern
                    Leave_Request__c halfDayReq = new Leave_Request__c(
                        Employee__c = originalLeave.Employee__c,
                        Leave_Type__c = originalLeave.Leave_Type__c,
                        From_Date__c = newEndDate, // The specific day
                        To_Date__c = newEndDate,
                        Reason__c = 'Convert to Half Day: ' + originalLeave.Reason__c,
                        Status__c = 'Cancellation Requested', // Flow is same
                        Submitted_Date__c = Date.today(),
                        Name = 'HD-' + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 6)
                    );
                    insert halfDayReq;
                }
            }

        } catch (Exception e) {
            throw new AuraHandledException('Error submitting partial cancellation: ' + e.getMessage());
        }
    }

    private static void finalizeApproval(Id leaveId, String comment) {
        try {
            Leave_Request__c leaveReq = [SELECT Id, Status__c, Employee__c, Leave_Type__c, Leave_Type__r.Name, 
                                                From_Date__c, To_Date__c, Reason__c, Number_of_Days__c 
                                         FROM Leave_Request__c WHERE Id = :leaveId];
            
            // 1. Determine Action Type
            Boolean isCancellationApproval = (leaveReq.Status__c == 'Cancellation Requested');

            // 2. Calculate Days / Duration OF THIS REQUEST
            Decimal daysVal = 0;
            Boolean isHalfDayConversion = (leaveReq.Reason__c != null && leaveReq.Reason__c.contains('Convert to Half Day'));
            
            if (isHalfDayConversion) {
                // If this is a conversion request, it represents the 0.5 day being "cancelled" (refunded)
                daysVal = 0.5; 
            } else if (leaveReq.Reason__c != null && leaveReq.Reason__c.contains('(Half Day')) {
                daysVal = 0.5;
            } else {
                daysVal = calculateLeaveDuration(leaveReq.From_Date__c, leaveReq.To_Date__c);
            }
            
            // 3. Prevent Double Action
            if (!isCancellationApproval && leaveReq.Status__c == 'HR_Approved') {
                return;
            }

            // 4. Update Balance
            if (leaveReq.Leave_Type__r.Name != null && !leaveReq.Leave_Type__r.Name.contains('Work From Home')) {
                List<Leave_Balance__c> balances = [SELECT Id, Used__c, Remaining__c FROM Leave_Balance__c 
                                                   WHERE Employee__c = :leaveReq.Employee__c 
                                                   AND Leave_Type__c = :leaveReq.Leave_Type__c LIMIT 1];
                
                if (!balances.isEmpty()) {
                    Leave_Balance__c bal = balances[0];
                    if (isCancellationApproval) {
                        // Refund (Cancellation or Half Day Conversion)
                        bal.Used__c = (bal.Used__c != null ? bal.Used__c : 0) - daysVal;
                        if (bal.Used__c < 0) bal.Used__c = 0; 
                    } else {
                        // Deduct
                        bal.Used__c = (bal.Used__c != null ? bal.Used__c : 0) + daysVal;
                    }
                    update bal;
                }
            }

            // 5. Update Status & Handle Effects
            if (isCancellationApproval) {
                leaveReq.Status__c = 'Cancelled';
                
                // Find Original Leave (that fully covers this period)
                List<Leave_Request__c> originalLeaves = [SELECT Id, From_Date__c, To_Date__c, Reason__c 
                                                         FROM Leave_Request__c 
                                                         WHERE Employee__c = :leaveReq.Employee__c
                                                         AND Status__c IN ('HR_Approved', 'Approved')
                                                         AND From_Date__c <= :leaveReq.From_Date__c
                                                         AND To_Date__c >= :leaveReq.To_Date__c
                                                         AND Id != :leaveReq.Id
                                                         LIMIT 1];
                
                if (!originalLeaves.isEmpty()) {
                    Leave_Request__c original = originalLeaves[0];
                    
                    if (isHalfDayConversion) {
                        // Logic: Update Original Reason to include (Half Day)
                        // Should we force it? Yes.
                        if (original.Reason__c == null) original.Reason__c = '';
                        if (!original.Reason__c.contains('(Half Day)')) {
                            original.Reason__c = original.Reason__c + ' (Half Day)';
                            update original;
                        }
                    } else {
                         // Standard Truncation Logic
                        if (leaveReq.From_Date__c > original.From_Date__c) { 
                            original.To_Date__c = leaveReq.From_Date__c.addDays(-1);
                            update original;
                        }
                    }
                }

            } else {
                leaveReq.Status__c = 'HR_Approved';
            }
            
            if (comment != null) {
                leaveReq.Manager_Approval_Comment__c = comment;
            }
            update leaveReq;
            
        } catch (Exception e) {
             throw new AuraHandledException('Action Failed: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Decimal calculateLeaveDuration(Date startDate, Date endDate) {
        if (startDate == null || endDate == null) return 0;
        
        // Optimisation: Fetch holidays once if possible, but for individual check this is okay.
        // ideally should delegate to the helper if we had holiday set.
        // Keeping original logic but could reuse helper if we queried holidays first.
        
        Integer totalDays = 0;
        Integer daysBetween = startDate.daysBetween(endDate);
        
        // 1. Fetch Holidays for range
        List<Holiday> holidays = [SELECT ActivityDate FROM Holiday 
                                  WHERE ActivityDate >= :startDate AND ActivityDate <= :endDate];
        Set<Date> holidayDates = new Set<Date>();
        for(Holiday h : holidays) {
            holidayDates.add(h.ActivityDate);
        }

        // Loop through each day
        for (Integer i = 0; i <= daysBetween; i++) {
            Date currentDate = startDate.addDays(i);
            
            // Check Weekend (Saturday=6, Sunday=0)
            DateTime dt = DateTime.newInstance(currentDate.year(), currentDate.month(), currentDate.day());
            String dayOfWeek = dt.format('EEE');
            
            if (dayOfWeek != 'Sat' && dayOfWeek != 'Sun' && !holidayDates.contains(currentDate)) {
                 totalDays++;
            }
        }
        
        return Math.max(0, totalDays);
    }

    // New Helper Method for Bulk Operations
    private static Decimal calculateWorkingDays(Date startDate, Date endDate, Set<Date> holidays) {
        if (startDate == null || endDate == null) return 0;
        Integer totalDays = 0;
        Integer daysBetween = startDate.daysBetween(endDate);
        
        for (Integer i = 0; i <= daysBetween; i++) {
            Date currentDate = startDate.addDays(i);
            DateTime dt = DateTime.newInstance(currentDate.year(), currentDate.month(), currentDate.day());
            String dayOfWeek = dt.format('EEE'); // This is locale dependent, but usually works for English
            
            if (dayOfWeek != 'Sat' && dayOfWeek != 'Sun' && !holidays.contains(currentDate)) {
                totalDays++;
            }
        }
        return totalDays;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getMyLeaves(Id userId) {
        return [SELECT Id, Name, Status__c, Leave_Type__c, Leave_Type__r.Name, Reason__c, Submitted_Date__c, From_Date__c, To_Date__c, Number_of_Days__c, Manager_Approval_Comment__c
                FROM Leave_Request__c WHERE Employee__c = :userId 
                ORDER BY Submitted_Date__c DESC];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Leave_Type__c> getLeaveTypes() {
        return [SELECT Id, Name, Available_During_Probation__c FROM Leave_Type__c WHERE Is_Active__c = true];
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Map<String, Decimal>> getLeaveBalances(Id userId) {
        Map<String, Map<String, Decimal>> balanceMap = new Map<String, Map<String, Decimal>>();
        Integer currentYear = Date.today().year();
        List<Leave_Balance__c> balances = [SELECT Leave_Type__r.Name, Remaining__c, Used__c FROM Leave_Balance__c WHERE Employee__c = :userId AND Year__c = :currentYear];
        
        for (Leave_Balance__c bal : balances) {
            Map<String, Decimal> details = new Map<String, Decimal>();
            
            // Handle Remaining
            Decimal remaining = bal.Remaining__c != null ? bal.Remaining__c : 0;
            // Visual Fix: Do not show negative balances.
            if (remaining < 0) remaining = 0;
            details.put('Remaining', remaining);

            // Handle Used
            Decimal used = bal.Used__c != null ? bal.Used__c : 0;
             details.put('Used', used);

            balanceMap.put(bal.Leave_Type__r.Name, details);
        }
        return balanceMap;
    }

    @AuraEnabled
    public static Boolean checkH1Limit(String startDate, String endDate, String leaveTypeId, String contactId) {
        Date d1 = Date.valueOf(startDate);
        Date d2 = Date.valueOf(endDate);
        Integer requestYear = d1.year();
        Date h1End = Date.newInstance(requestYear, 6, 30);

        if (d1 <= h1End) {
             String typeName = '';
             try {
                Leave_Type__c lt = [SELECT Name FROM Leave_Type__c WHERE Id = :leaveTypeId LIMIT 1];
                typeName = lt.Name;
             } catch (Exception e) { return false; }

             if (typeName.contains('Casual') || typeName.contains('Sick')) {
                 Decimal currentDays = calculateLeaveDuration(d1, d2);
                 Date h1Start = Date.newInstance(requestYear, 1, 1);
                 
                 AggregateResult[] results = [
                    SELECT SUM(Number_of_Days__c) totalUsed
                    FROM Leave_Request__c 
                    WHERE Employee__c = :contactId
                    AND Leave_Type__c = :leaveTypeId
                    AND Status__c NOT IN ('Rejected', 'Cancelled', 'Manager_Rejected')
                    AND From_Date__c >= :h1Start
                    AND From_Date__c <= :h1End
                 ];
                 
                 Decimal usedDays = (results[0].get('totalUsed') != null) ? (Decimal)results[0].get('totalUsed') : 0;
                 Decimal totalProjected = usedDays + currentDays;

                 if (typeName.contains('Casual') && totalProjected > 6) return true;
                 if (typeName.contains('Sick') && totalProjected > 3) return true;
             }
        }
        return false; // Not exceeded
    }

    @AuraEnabled
    public static Leave_Request__c createLeave(String startDate, String endDate, String leaveTypeId, String reason, String contactId) {
        Date d1 = Date.valueOf(startDate);
        Date d2 = Date.valueOf(endDate);
        
        // WEEKEND-ONLY VALIDATION
        // Check if all selected days are weekends
        Integer weekdayCount = 0;
        Integer daysBetween = d1.daysBetween(d2);
        
        for (Integer i = 0; i <= daysBetween; i++) {
            Date currentDate = d1.addDays(i);
            DateTime dt = DateTime.newInstance(currentDate.year(), currentDate.month(), currentDate.day());
            String dayOfWeek = dt.format('EEE');
            
            if (dayOfWeek != 'Sat' && dayOfWeek != 'Sun') {
                weekdayCount++;
            }
        }
        
        if (weekdayCount == 0) {
            throw new AuraHandledException('Leave cannot be applied for weekends only. Please include at least one weekday.');
        }
        
        // Note: Number_of_Days__c is a formula field, so we don't set it here.
        // Days_to_Deduct__c is also read-only in this context.
        // We will calculate deduction logic at approval time.

        // DUPLICATE CHECK
        List<Leave_Request__c> existingLeaves = [
            SELECT Id FROM Leave_Request__c 
            WHERE Employee__c = :contactId 
            AND Status__c NOT IN ('Rejected', 'Cancelled')
            AND (
                (From_Date__c <= :d2 AND To_Date__c >= :d1)
            )
            LIMIT 1
        ];
        
        if (!existingLeaves.isEmpty()) {
             throw new AuraHandledException('You already have a leave request for this period.');
        }


        // 1. Fetch Default Manager (CT01) or Employee's Manager
        Id managerId;
        List<Contact> defaultManager = [SELECT Id FROM Contact WHERE Employee_ID__c = 'CT01' LIMIT 1];
        
        if (!defaultManager.isEmpty()) {
            managerId = defaultManager[0].Id;
        } else {
             // Fallback to Salesforce Hierarchy
             Contact employee = [SELECT ReportsToId FROM Contact WHERE Id = :contactId LIMIT 1];
             managerId = employee.ReportsToId;
        }

        // Check Leave Type Name for Auto-Approval - REMOVED PER USER REQUEST
        String status = 'Submitted';
        
        // --- OPTIONAL HOLIDAY VALIDATION ---
        try {
            Leave_Type__c selectedType = [SELECT Name, Annual_Quota__c FROM Leave_Type__c WHERE Id = :leaveTypeId LIMIT 1];
            if (selectedType.Name != null && selectedType.Name.containsIgnoreCase('Optional Holiday')) {
                
                // 1. Validate Date (Must be one of the specified Optional Holidays)
                // Defined Dates for 2026: Bakrid (May 27), Muharram (Jun 26)
                Set<Date> allowedDates = new Set<Date>{
                    Date.newInstance(2026, 5, 27),
                    Date.newInstance(2026, 6, 26)
                };
                
                if (!allowedDates.contains(d1)) {
                     throw new AuraHandledException('Invalid Date for Optional Holiday. Allowed dates are: May 27, Jun 26 (2026).');
                }
                if (d1 != d2) {
                     throw new AuraHandledException('Optional Holidays must be applied for one day at a time.');
                }
                
                // 2. Validate Quota (Max 1 per Year)
                Integer usedCount = [SELECT Count() FROM Leave_Request__c 
                                     WHERE Employee__c = :contactId 
                                     AND Leave_Type__c = :leaveTypeId
                                     AND Status__c NOT IN ('Rejected', 'Cancelled', 'Manager_Rejected')
                                     AND CALENDAR_YEAR(From_Date__c) = 2026];
                                     
                if (usedCount >= 1) { 
                     throw new AuraHandledException('You have already utilised your quota of 1 Optional Holiday for this year.');
                }
            }
        } catch (Exception e) {
            if (e.getTypeName() == 'System.AuraHandledException') throw e; // Rethrow custom errors
            System.debug('Error validating optional leave: ' + e.getMessage());
        }
        // -----------------------------------
        
        Leave_Request__c leaveReq = new Leave_Request__c(
            Employee__c = contactId,
            Reporting_Manager__c = managerId, // Set the Manager
            Leave_Type__c = leaveTypeId,
            From_Date__c = d1,
            To_Date__c = d2,
            Reason__c = reason,
            Status__c = status,
            Submitted_Date__c = Date.today(),
            Name = 'LR-' + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 6) 
        );
        try {
            insert leaveReq;
            

            
            // Send Email Notification - REMOVED
            // sendLeaveNotification(leaveReq.Id);
            
        } catch (Exception e) {
            throw new AuraHandledException('Error creating leave request: ' + e.getMessage());
        }
        return leaveReq;
    }



    @AuraEnabled
    public static void deleteLeaveRequest(Id leaveId) {
        try {
            Leave_Request__c leaveReq = [SELECT Id, Status__c, Employee__c, Leave_Type__c, From_Date__c, To_Date__c, Reason__c FROM Leave_Request__c WHERE Id = :leaveId LIMIT 1];
            
            // Scenario 1: Already Approved (HR_Approved or Approved) -> Request Cancellation
            if (leaveReq.Status__c == 'HR_Approved' || leaveReq.Status__c == 'Approved') {
                // Prevent cancelling past leaves
                if (leaveReq.To_Date__c < Date.today()) {
                    throw new AuraHandledException('Cannot cancel past leaves. Please contact HR for corrections.');
                }
                
                leaveReq.Status__c = 'Cancellation Requested';
                update leaveReq;
            } else {
                // Scenario 2: Pending/Draft/Rejected -> Hard Delete
                if (leaveReq.From_Date__c < Date.today()) {
                    throw new AuraHandledException('Cannot delete past leaves. Please contact HR for corrections.');
                }
                delete leaveReq;
            }

        } catch (Exception e) {
            throw new AuraHandledException('Error processing request: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteAllMyLeaves(Id userId) {
        try {
            List<Leave_Request__c> allLeaves = [SELECT Id FROM Leave_Request__c WHERE Employee__c = :userId];
            if (!allLeaves.isEmpty()) {
                delete allLeaves;
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting all leaves: ' + e.getMessage());
        }
    }
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getTeamStatus(String callerId) {
        SecurityMiddleware.verifyAdminOrHROrManager(callerId);
        List<Map<String, String>> teamStatus = new List<Map<String, String>>();
        Date today = Date.today();
        
        // 1. Get Active Leaves for Today (Approved and Pending)
        List<Leave_Request__c> activeLeaves = [SELECT Employee__c, Leave_Type__r.Name 
                                               FROM Leave_Request__c 
                                               WHERE Status__c IN ('HR_Approved', 'Approved', 'Submitted', 'Pending HR Approval') 
                                               AND From_Date__c <= :today 
                                               AND To_Date__c >= :today];
        
        // 2. Collect Employee IDs and Map Leave Types
        Set<Id> employeeIds = new Set<Id>();
        Map<Id, String> leaveMap = new Map<Id, String>();
        
        for (Leave_Request__c lr : activeLeaves) {
            employeeIds.add(lr.Employee__c);
            leaveMap.put(lr.Employee__c, lr.Leave_Type__r.Name);
        }
        
        // 3. Get Details Only for Employees on Leave
        if (!employeeIds.isEmpty()) {
            List<Contact> employeesOnLeave = [SELECT Id, Name, Employee_ID__c, Employee_Type__c 
                                          FROM Contact 
                                          WHERE Id IN :employeeIds 
                                          ORDER BY Name ASC];
            
            for (Contact emp : employeesOnLeave) {
                Map<String, String> statusMap = new Map<String, String>();
                statusMap.put('Id', emp.Id);
                statusMap.put('Name', emp.Name);
                statusMap.put('EmployeeId', emp.Employee_ID__c);
                statusMap.put('Type', emp.Employee_Type__c);
                
                String leaveType = leaveMap.get(emp.Id);
                // Handle WFH Display
                if (leaveType != null && leaveType.contains('Work From Home')) {
                     statusMap.put('Status', 'Work From Home');
                } else {
                     statusMap.put('Status', leaveType);
                }
                statusMap.put('StatusColor', 'slds-text-color_error');
                
                teamStatus.add(statusMap);
            }
        }
        
        return teamStatus;
    }
    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getHRStats(String callerId) {
        SecurityMiddleware.verifyHR(callerId);
        Map<String, Integer> stats = new Map<String, Integer>();
        
        // 1. Total Requests (All time)
        stats.put('totalRequests', [SELECT Count() FROM Leave_Request__c]);
        
        // 2. Approved (All time)
        stats.put('approvedCount', [SELECT Count() FROM Leave_Request__c WHERE Status__c = 'HR_Approved']);
        
        // 3. Rejected (All time - Manager or HR)
        stats.put('rejectedCount', [SELECT Count() FROM Leave_Request__c WHERE Status__c LIKE '%Rejected']);
        
        // 4. Cancelled (All time)
        stats.put('cancelledCount', [SELECT Count() FROM Leave_Request__c WHERE Status__c = 'Cancelled']);
        
        // 5. Pending (Submitted, Pending HR Approval, Cancellation Requested)
        stats.put('pendingCount', [SELECT Count() FROM Leave_Request__c WHERE Status__c IN ('Submitted', 'Pending HR Approval', 'Cancellation Requested')]);
        
        return stats;
    }
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getMonthLeaves(Integer month, Integer year) {
        if (month == null || year == null) {
            Date today = Date.today();
            month = today.month();
            year = today.year();
        }
        return [SELECT Id, Employee__r.Name, Employee__r.Employee_ID__c, Employee__r.Joining_Date__c, 
                       Employee__r.Department__c, Employee__r.Employee_Type__c,
                       Leave_Type__r.Name, From_Date__c, To_Date__c, Number_of_Days__c, Status__c, Reason__c 
                FROM Leave_Request__c 
                WHERE CALENDAR_MONTH(Submitted_Date__c) = :month
                AND CALENDAR_YEAR(Submitted_Date__c) = :year
                ORDER BY Submitted_Date__c DESC];
    }
    
    @AuraEnabled(cacheable=true)
    public static Decimal getWFHTakenCount(Id userId) {
        if (userId == null) {
            return 0;
        }
        
        List<Leave_Request__c> leaves = [
            SELECT Number_of_Days__c, Reason__c, From_Date__c, To_Date__c 
            FROM Leave_Request__c 
            WHERE Employee__c = :userId 
            AND Leave_Type__r.Name LIKE '%Work From Home%'
            AND (Status__c = 'HR_Approved' OR Status__c = 'Approved')
            AND CALENDAR_YEAR(From_Date__c) = :Date.today().year()
        ];
        
        // Fetch Holidays (Optimized)
        Date startOfYear = Date.newInstance(Date.today().year(), 1, 1);
        Date endOfYear = Date.newInstance(Date.today().year(), 12, 31);
        
        Set<Date> holidaySet = new Set<Date>();
        for (Holiday h : [SELECT ActivityDate FROM Holiday WHERE ActivityDate >= :startOfYear AND ActivityDate <= :endOfYear]) {
            holidaySet.add(h.ActivityDate);
        }

        Decimal total = 0;
        for (Leave_Request__c l : leaves) {
             if (l.Reason__c != null && l.Reason__c.contains('(Half Day')) {
                 total += 0.5;
             } else {
                 // REPLACED: Ignore formula field, recalculate strictly excluding weekends
                 total += calculateWorkingDays(l.From_Date__c, l.To_Date__c, holidaySet);
             }
        }
        return total;
    }
    @AuraEnabled(cacheable=true)
    public static Decimal getLOPCount(Id userId) {
        if (userId == null) {
            return 0;
        }

        // 1. Calculate Excess Usage from Standard Leaves (Casual, Sick, etc.)
        // Logic: excess = Used__c - Opening_Balance__c. Sum only if excess > 0.
        List<Leave_Balance__c> balances = [SELECT Leave_Type__r.Name, Used__c, Opening_Balance__c 
                                           FROM Leave_Balance__c 
                                           WHERE Employee__c = :userId 
                                           AND Year__c = :Date.today().year()];
        
        Decimal totalExcess = 0;
        
        for (Leave_Balance__c bal : balances) {
             Decimal used = bal.Used__c != null ? bal.Used__c : 0;
             Decimal opening = bal.Opening_Balance__c != null ? bal.Opening_Balance__c : 0;
             
             // If used more than allocated, that difference is LOP
             if (used > opening) {
                 totalExcess += (used - opening);
             }
        }
        
        // 2. Add Explicit "Loss of Pay" requests (if any exist as a specific leave type)
        // Typically, if a "Loss of Pay" leave type exists, it might have 0 opening balance, 
        // so the above logic (used > opening) covers it automatically!
        // (Used: 5, Opening: 0 => Excess: 5).
        
        return totalExcess;
    }


    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getTeamAnalytics(String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        List<Map<String, Object>> analytics = new List<Map<String, Object>>();
        
        // 1. Get All Employees (Filtered: CT%, Not Manager, Not Harish Kumar)
        List<Contact> employees = [SELECT Id, Name, Employee_ID__c 
                                   FROM Contact 
                                   WHERE Employee_ID__c LIKE 'CT%' 
                                   AND Employee_Type__c != 'Manager'
                                   AND Name != 'Harish Kumar'
                                   ORDER BY Name ASC];
        
        // 2. Get Balances (Casual & Sick)
        Map<Id, Map<String, Decimal>> balanceMap = new Map<Id, Map<String, Decimal>>();
        List<Leave_Balance__c> balances = [SELECT Employee__c, Leave_Type__r.Name, Remaining__c FROM Leave_Balance__c];
        
        for (Leave_Balance__c bal : balances) {
            if (!balanceMap.containsKey(bal.Employee__c)) {
                balanceMap.put(bal.Employee__c, new Map<String, Decimal>());
            }
            balanceMap.get(bal.Employee__c).put(bal.Leave_Type__r.Name, bal.Remaining__c);
        }

        // 3. Get Usage Stats MANUALLY (to handle Half Day 0.5 logic & Weekend Exclusion)
        Map<Id, Decimal> totalTakenMap = new Map<Id, Decimal>();
        Map<Id, Decimal> wfhMap = new Map<Id, Decimal>();
        Map<Id, Decimal> lopMap = new Map<Id, Decimal>();

        // Pre-fetch Holidays for Calculation
        Date startOfYear = Date.newInstance(Date.today().year(), 1, 1);
        Date endOfYear = Date.newInstance(Date.today().year(), 12, 31);

        Set<Date> holidaySet = new Set<Date>();
        for (Holiday h : [SELECT ActivityDate FROM Holiday WHERE ActivityDate >= :startOfYear AND ActivityDate <= :endOfYear]) {
            holidaySet.add(h.ActivityDate);
        }

        List<Leave_Request__c> allLeaves = [
            SELECT Employee__c, Leave_Type__r.Name, Number_of_Days__c, Reason__c, From_Date__c, To_Date__c
            FROM Leave_Request__c 
            WHERE Status__c IN ('Approved', 'HR_Approved')
            AND CALENDAR_YEAR(From_Date__c) = :Date.today().year()
        ];

        for (Leave_Request__c lr : allLeaves) {
            Id empId = lr.Employee__c;
            String type = lr.Leave_Type__r.Name;
            
            // Calculate Days Logic (With Weekend/Holiday Exclusion for non-formula reliance)
            Decimal days = 0;
            if (lr.Reason__c != null && lr.Reason__c.contains('(Half Day')) {
                days = 0.5;
            } else {
                 // ALWAYS recalculate to ensure weekend exclusion for WFH/Analytics
                 days = calculateWorkingDays(lr.From_Date__c, lr.To_Date__c, holidaySet);
            }

            if (type != null) {
                if (type.contains('Work From Home')) {
                     if (!wfhMap.containsKey(empId)) wfhMap.put(empId, 0);
                     wfhMap.put(empId, wfhMap.get(empId) + days);
                } else if (type.contains('Loss of Pay')) {
                     if (!lopMap.containsKey(empId)) lopMap.put(empId, 0);
                     lopMap.put(empId, lopMap.get(empId) + days);
                     
                     // Add to Total Taken (LOP usually counts as taken)
                     if (!totalTakenMap.containsKey(empId)) totalTakenMap.put(empId, 0);
                     totalTakenMap.put(empId, totalTakenMap.get(empId) + days);
                } else {
                     // Add to Total Taken only if NOT WFH
                     if (!totalTakenMap.containsKey(empId)) totalTakenMap.put(empId, 0);
                     totalTakenMap.put(empId, totalTakenMap.get(empId) + days);
                }
            }
        }

        // 4. Build Result List
        for (Contact emp : employees) {
            Map<String, Object> row = new Map<String, Object>();
            row.put('Id', emp.Id);
            row.put('Name', emp.Name);
            row.put('EmployeeId', emp.Employee_ID__c);
            
            // Balances
            Map<String, Decimal> empBals = balanceMap.containsKey(emp.Id) ? balanceMap.get(emp.Id) : new Map<String, Decimal>();
            row.put('CasualBal', empBals.containsKey('Casual Leave') ? empBals.get('Casual Leave') : 0);
            row.put('SickBal', empBals.containsKey('Sick Leave') ? empBals.get('Sick Leave') : 0);
            
            // Usage Stats
            row.put('TotalTaken', totalTakenMap.containsKey(emp.Id) ? totalTakenMap.get(emp.Id) : 0);
            row.put('WFHDays', wfhMap.containsKey(emp.Id) ? wfhMap.get(emp.Id) : 0);
            row.put('LOPDays', lopMap.containsKey(emp.Id) ? lopMap.get(emp.Id) : 0);
            
            analytics.add(row);
        }
        
        return analytics;
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getLeavesByDateRange(Date startDate, Date endDate, String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        if (startDate == null || endDate == null) {
            return new List<Leave_Request__c>();
        }
        
        return [SELECT Id, Name, Employee__r.Name, Employee__r.Employee_ID__c, 
                       Leave_Type__r.Name, From_Date__c, To_Date__c, Number_of_Days__c, Status__c, Reason__c
                FROM Leave_Request__c 
                WHERE (From_Date__c <= :endDate AND To_Date__c >= :startDate)
                AND Status__c IN ('Approved', 'HR_Approved')
                ORDER BY From_Date__c DESC];
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getLeavesByDateRangeAndStatus(Date startDate, Date endDate, List<String> statuses, String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        if (startDate == null || endDate == null) {
            return new List<Leave_Request__c>();
        }
        
        return [SELECT Id, Name, Employee__r.Name, Employee__r.Employee_ID__c, 
                       Leave_Type__r.Name, From_Date__c, To_Date__c, Number_of_Days__c, Status__c, Reason__c
                FROM Leave_Request__c 
                WHERE (From_Date__c <= :endDate AND To_Date__c >= :startDate)
                AND Status__c IN :statuses
                ORDER BY From_Date__c DESC];
    }

    // --- HR MARK LEAVE FEATURE ---

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getEmployees(String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Contact c : [SELECT Id, Name, Employee_ID__c FROM Contact WHERE Employee_ID__c != NULL ORDER BY Name]) {
            Map<String, String> option = new Map<String, String>();
            option.put('label', c.Name + ' (' + c.Employee_ID__c + ')');
            option.put('value', c.Id);
            options.add(option);
        }
        return options;
    }

    @AuraEnabled
    public static void createLeaveByHR(Id employeeId, Date fromDate, Date toDate, String leaveType, String reason, String leaveTypeId, Boolean isHalfDay, String markedByName, String halfDaySession, String callerId) {
        SecurityMiddleware.verifyAdminOrHR(callerId);
        try {
            // 1. Check for Holiday Overlap
            List<Holiday> overlappingHolidays = [SELECT Name, ActivityDate FROM Holiday 
                                                 WHERE ActivityDate >= :fromDate AND ActivityDate <= :toDate];
            if (!overlappingHolidays.isEmpty()) {
                Holiday h = overlappingHolidays[0];
                // Format Date for clarity
                String dateStr = DateTime.newInstance(h.ActivityDate.year(), h.ActivityDate.month(), h.ActivityDate.day()).format('MMM dd, yyyy');
                throw new AuraHandledException('Cannot mark leave: Selected date overlaps with Holiday "' + h.Name + '" on ' + dateStr + '.');
            }

            // 2. Check for Existing Leave Overlap
            List<Leave_Request__c> existingLeaves = [SELECT Leave_Type__r.Name, From_Date__c, To_Date__c, Status__c, Reason__c
                                                     FROM Leave_Request__c 
                                                     WHERE Employee__c = :employeeId
                                                     AND Status__c IN ('Approved', 'HR_Approved', 'Submitted', 'Pending HR Approval')
                                                     AND To_Date__c >= :fromDate 
                                                     AND From_Date__c <= :toDate]; // Standard Overlap Logic
            
            if (!existingLeaves.isEmpty()) {
                Leave_Request__c ext = existingLeaves[0];
                String lType = ext.Leave_Type__r.Name != null ? ext.Leave_Type__r.Name : 'Leave';
                String reasonInfo = String.isNotBlank(ext.Reason__c) ? ' (' + ext.Reason__c + ')' : '';
                throw new AuraHandledException('Cannot mark leave: Employee already has "' + lType + '" marked for this period' + reasonInfo + '.');
            }

            Leave_Request__c leave = new Leave_Request__c();
            leave.Employee__c = employeeId;
            leave.From_Date__c = fromDate;
            leave.To_Date__c = toDate;
            
            // Append Half Day to reason for logic detection
            String finalReason = reason;
            if (isHalfDay != null && isHalfDay) {
                String suffix = ' (Half Day';
                if (String.isNotBlank(halfDaySession)) {
                    suffix += ' - ' + halfDaySession;
                }
                suffix += ')';
                finalReason = (String.isNotBlank(finalReason) ? finalReason : 'Half Day Leave') + suffix;
            }
            leave.Reason__c = finalReason;
            
            leave.Leave_Type__c = leaveTypeId;
            
            // HR Entry -> Submitted first, then Approved to trigger deduction logic
            leave.Status__c = 'Submitted'; 
            leave.Submitted_Date__c = Date.today(); 
            leave.Name = 'HR-' + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 6);
            
            insert leave;
            
            // Now Trigger Approval (which handles balance deduction)
            String approverInfo = 'Auto-Approved by ' + (String.isBlank(markedByName) ? 'HR Entry' : markedByName);
            approveLeaveByHR(leave.Id, approverInfo, callerId);
            
            System.debug('HR Created & Approved Leave: ' + leave.Id + ' for Employee: ' + employeeId);

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating leave: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getUpcomingHolidays() {
        Date startOfYear = Date.today(); 
        List<Holiday> holidays = [SELECT Id, Name, ActivityDate, IsRecurrence, RecurrenceStartDate, RecurrenceType
                                  FROM Holiday 
                                  WHERE ActivityDate >= :startOfYear OR RecurrenceStartDate != null
                                  ORDER BY ActivityDate ASC];

        List<Map<String, Object>> result = new List<Map<String, Object>>();
        Set<String> optionalHolidays = new Set<String>{'Bakrid', 'Muharram', 'First Onam', 'Mahanavami'};

        for (Holiday h : holidays) {
            Map<String, Object> hMap = new Map<String, Object>();
            hMap.put('Id', h.Id); 
            hMap.put('Name', h.Name);
            hMap.put('ActivityDate', h.ActivityDate);
            
            // Replicate IsOptional logic manually
            if (optionalHolidays.contains(h.Name)) {
                hMap.put('isOptional', true);
            } else {
                hMap.put('isOptional', false);
            }
            result.add(hMap);
        }
        return result;
    }
}