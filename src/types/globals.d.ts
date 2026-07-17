export { }

declare global {
    interface CustomJwtSessionClaims {
        metadata: {
            role?: "Admin" | "PNC" | "Member";
            team?: "CEO's Office" | "Alumni Growth" | "Pay-Forward" | "Alumni Network" | "None";
            volunteerEnabled?: boolean;
            userManagementEnabled?: boolean;
        };
    }
}
