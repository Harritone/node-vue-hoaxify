module.exports = function ForbiddenException() {
  this.status = 403;
  this.message = 'inactive_account_failure';
};
