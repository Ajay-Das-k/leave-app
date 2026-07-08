import { LightningElement, api, track } from 'lwc';

export default class CalendarWidget extends LightningElement {
    // @api holidays = []; // REMOVED DUPLICATE
    // @api leaves = [];   // List of Leave Requests {From_Date__c, To_Date__c, Status__c, Leave_Type__r.Name}

    @track currentMonthDate = new Date();
    @track calendarDays = [];

    connectedCallback() {
        this.generateCalendar();
    }

    // React to changes in inputs
    set holidays(value) {
        this._holidays = value;
        this.generateCalendar();
    }
    @api get holidays() { return this._holidays; }
    _holidays = [];

    set leaves(value) {
        this._leaves = value;
        this.generateCalendar();
    }
    @api get leaves() { return this._leaves; }
    _leaves = [];


    get currentMonthName() {
        return this.currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    previousMonth() {
        this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() - 1);
        this.currentMonthDate = new Date(this.currentMonthDate);
        this.generateCalendar();
    }

    nextMonth() {
        this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() + 1);
        this.currentMonthDate = new Date(this.currentMonthDate);
        this.generateCalendar();
    }

    generateCalendar() {
        const year = this.currentMonthDate.getFullYear();
        const month = this.currentMonthDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayIndex = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
        
        const calendarGrid = [];
        
        // Empty cells for days belonging to previous month
        for (let i = 0; i < startDayIndex; i++) {
            calendarGrid.push({ key: `empty-${i}`, day: '', class: 'calendar-day empty' });
        }
        
        // Days of current month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            let dayClass = 'calendar-day';
            let title = '';
            
            // Check for Holiday
            const holiday = this._holidays ? this._holidays.find(h => h.ActivityDate === dateStr) : null;
            if (holiday) {
                dayClass += ' holiday';
                title = `Holiday: ${holiday.Name}`;
            }

            // Check for Leave (if passed)
            let leave = null;
            if (this._leaves && this._leaves.length > 0) {
                leave = this._leaves.find(l => {
                    return dateStr >= l.From_Date__c && 
                           dateStr <= l.To_Date__c && 
                           (l.Status__c === 'Approved' || l.Status__c === 'HR_Approved');
               });
            }
            
            if (leave) {
                // Check if it's Work From Home
                const isWFH = leave.Leave_Type__r && leave.Leave_Type__r.Name && 
                              leave.Leave_Type__r.Name.includes('Work From Home');
                
                if (isWFH) {
                    dayClass += ' wfh-leave'; // Yellow marker for WFH
                } else {
                    dayClass += ' leave-taken'; // Red/green marker for regular leave
                }
                title = title ? `${title} & Leave` : `Leave: ${leave.Leave_Type__r.Name}`;
            }

            calendarGrid.push({
                key: dateStr,
                day: i,
                class: dayClass,
                title: title
            });
        }
        
        this.calendarDays = calendarGrid;
    }
}