import { LightningElement, track } from 'lwc';

export default class PaybookRouter extends LightningElement {
    @track currentPage;
    @track userRole;
    @track isAuthorized = false;

    connectedCallback() {
        // Check if user is logged in
        const userJson = sessionStorage.getItem('paybookUser');
        
        if (!userJson) {
            // Not logged in - redirect to login
            window.location.href = '/s/login';
            return;
        }

        const user = JSON.parse(userJson);
        this.userRole = user.userRole;

        // Validate page access based on role
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('employee') && user.userRole !== 'Employee') {
            window.location.href = '/s/unauthorized';
            return;
        }
        
        if (currentPath.includes('manager') && user.userRole !== 'Manager') {
            window.location.href = '/s/unauthorized';
            return;
        }
        
        if (currentPath.includes('hr') && user.userRole !== 'HR Admin') {
            window.location.href = '/s/unauthorized';
            return;
        }

        this.isAuthorized = true;
    }
}