export const controls = [
  {
    id: "CC1.1",
    name: "Access Control Policy",
    status: "Completed",
    evidence: 5,
    owner: "Security Team",
    risk: "Excessive Privileges",
    recommendation:
      "Review inactive accounts every 90 days."
  },

  {
    id: "CC1.2",
    name: "Multi-Factor Authentication",
    status: "Completed",
    evidence: 3,
    owner: "IT Team",
    risk: "Weak Authentication",
    recommendation:
      "Enable MFA for all privileged users."
  },

  {
    id: "CC2.1",
    name: "Audit Logging",
    status: "Completed",
    evidence: 7,
    owner: "Infrastructure Team",
    risk: "Insufficient Logging",
    recommendation:
      "Retain logs for 12 months."
  },

  {
    id: "CC3.1",
    name: "Vendor Risk Review",
    status: "In Progress",
    evidence: 2,
    owner: "Compliance Team",
    risk: "Third Party Risk",
    recommendation:
      "Review vendor SOC reports annually."
  },

  {
    id: "CC4.1",
    name: "Incident Response Testing",
    status: "Missing",
    evidence: 0,
    owner: "Security Team",
    risk: "Unprepared Incident Response",
    recommendation:
      "Conduct tabletop exercises quarterly."
  }
];