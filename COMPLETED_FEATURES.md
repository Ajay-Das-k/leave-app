# CRMantra Leave & Hardware Management Application

This document lists all features, bug fixes, design enhancements, and technical solutions implemented from the beginning of the project.

---

## 1. Portal Authentication & User Security

### Redesigned Login, Signup, and Password Reset Interface
* **Enterprise Split-Screen Layout:** Built a modern two-column layout for the portal login page.
  * **Left Column:** Form field controls featuring inline vector icons, real-time validations, and a clean white color scheme.
  * **Right Column:** Stylized corporate office team picture in the background, overlaid with a premium translucent red gradient cover.
  * **Brand Identity:** Styled the login pane with the official **CRMantra** company logo imported from a Salesforce static resource.
  * **Mockup Visuals:** Added an interactive dot-network network wrapper, pulsing status indicators, and a glowing dashboard card overlay.
* **Controlled Access / Disabled Self-Registration:** Removed the open "Create an Account" registration links to prevent unauthorized users from self-signing up. Access is now managed exclusively by the HR Admin.
* **Secure Forgot Password Recovery Flow:** Implemented an OTP request screen supporting Employee ID and verified Email address inputs.

### Outbound Email Deliverability Fixes
* **Welcome Email Delivery:** Resolved Salesforce Guest User limits that blocked welcome emails for newly registered employees by updating the Apex trigger to map contacts via internal IDs (`setTargetObjectId`) and send via verified **Org-Wide Email Addresses**.
* **Password Reset OTP Delivery:** Restructured the `generateResetOTP` method in `PaybookLoginController.cls` to utilize target contact IDs and the verified Org-Wide Email Address, ensuring OTP mails are delivered directly to the user's inbox instead of getting blocked as spam.

---

## 2. Office Hardware Management

### Hardware Inventory Seeding & Maintenance
* **Data Cleaning:** Cleared all obsolete or incomplete hardware records using Apex scripts.
* **Seed Data Distribution:** Configured and ran data loader scripts to automatically assign 4 unique hardware items to each employee (MacBook Pro, Monitor, Apple/Logitech Keyboards, and Mouse accessories).

### Lifecycle & Warranty Tracking
* **Warranty calculations:** Tracks the lifespan (months), warranty period (months), purchase date, and remaining warranty duration for each asset.
* **Life Used Percentage:** Automatically calculates the percentage of the product's lifespan used.
* **Lifespan Status Badges:** Renders dynamic color-coded badges indicating device health:
  * **Green (Available/Healthy):** Devices with low usage and active warranties.
  * **Yellow (Under Maintenance/Moderate):** Devices approaching end of warranty.
  * **Red (Retired/End-of-Life):** Devices past warranty or near retirement.

---

## 3. Dashboard Modals & Reports

### Dynamic Hardware Details Modal
* Clicking any hardware item in the system pops up a detailed specification window containing:
  * Hardware Type, Name, Serial Number, and current Status.
  * Purchase Date, Lifespan, and Warranty Months.
  * Computed Life Used percentage and graphical badges.

### Click-to-View Badges
* Made the hardware badges interactive across:
  * **Employee Portal:** Clickable device names in the main hardware asset list.
  * **HR Admin Dashboard:** Interactive badges inside the "All Hardware" list and the "User Wise" hardware allocation list.
  * **Manager Dashboard:** Clickable badges inside both the "All Hardware" inventory list and the "User Wise" reports.

### Solved Requests & Tickets History View
* Added a dedicated **Solved Requests & Tickets** tab to both the HR Admin and Manager dashboards.
* Enables managers and admins to view historically closed requests (Approved, Rejected, Fulfilled) and resolved hardware maintenance tickets.
* Includes "Deliver" actions directly in the solved history list to mark items as fulfilled upon delivery.

---

## 4. HR Admin Dashboard Stability

* **Null Pointer Exception Resolution:** Patched the core crash `Cannot read properties of undefined (reading 'Name')` inside the HR Admin dashboard. Added robust safe-navigation checks to check if the current user object is fully loaded before referencing nested attributes.

---
