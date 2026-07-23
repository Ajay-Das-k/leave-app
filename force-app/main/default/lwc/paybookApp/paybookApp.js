import { LightningElement, track } from 'lwc';
import companyLogo from '@salesforce/resourceUrl/CompanyLogo';

export default class PaybookApp extends LightningElement {
    @track isLoggedIn = false;
    @track showUnauthorized = false;
    @track currentUser = null;
    
    get companyLogoUrl() {
        return companyLogo;
    }

    // Role flags for conditional rendering
    @track isEmployee = false;
    @track isManager = false;
    @track isHR = false;

    connectedCallback() {
        // Check if user session exists when component loads
        this.checkUserSession();
    }

    checkUserSession() {
        const userJson = sessionStorage.getItem('paybookUser');
        
        if (userJson) {
            try {
                const user = JSON.parse(userJson);
                this.currentUser = user;
                this.isLoggedIn = true;
                this.setUserRole(user.userRole);
            } catch (error) {
                console.error('Error parsing user session:', error);
                this.clearSession();
            }
        } else {
            this.isLoggedIn = false;
        }
    }

    setUserRole(role) {
        // Reset all flags
        this.isEmployee = false;
        this.isManager = false;
        this.isHR = false;

        // Set appropriate flag based on role
        switch(role) {
            case 'Employee':
                this.isEmployee = true;
                break;
            case 'Manager':
                this.isManager = true;
                break;
            case 'HR Admin':
                this.isHR = true;
                break;
            default:
                this.showUnauthorized = true;
        }
    }

    handleLogin(event) {
        const loginData = event.detail;
        
        // Store user in sessionStorage
        sessionStorage.setItem('paybookUser', JSON.stringify(loginData));

        // Update component state
        this.currentUser = loginData;
        this.isLoggedIn = true;
        this.setUserRole(loginData.userRole);

        // Scroll to top
        window.scrollTo(0, 0);
    }

    handleLogout() {
        // Clear session
        this.clearSession();
        
        // Reset component state
        this.isLoggedIn = false;
        this.isEmployee = false;
        this.isManager = false;
        this.isHR = false;
        this.showUnauthorized = false;
        this.currentUser = null;

        // Scroll to top
        window.scrollTo(0, 0);
    }

    clearSession() {
        sessionStorage.removeItem('paybookUser');
    }
}