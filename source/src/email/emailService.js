const transporter = require('../config/emailTransporter');

const sendAccountActivation = async (email, token) => {
  await transporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account activation',
    html: `Token: ${token}`,
  });
};

module.exports = { sendAccountActivation };
