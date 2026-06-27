export { }

declare global {
    interface CustomJwtSessionClaims {
        metadata: {
            role?: "Super Admin" | "Admin" | "Manager" | "Operator" | "Analyst" | "Viewer" | "Member" | "Program" | "Operations" | "Volunteer";
            team?: "CEO's Office" | "Alumni Growth" | "Pay-Forward" | "Alumni Network" | "None";
            volunteerEnabled?: boolean;
            userManagementEnabled?: boolean;
        };
    }
}
