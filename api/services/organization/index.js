const OrganizationService = require('./Organization');

module.exports = {
  createOrganization: OrganizationService.createOrganization.bind(OrganizationService),
  inviteUserToOrganization: OrganizationService.inviteUserToOrganization.bind(OrganizationService),
  resendInvite: OrganizationService.resendInvite.bind(OrganizationService),
};
