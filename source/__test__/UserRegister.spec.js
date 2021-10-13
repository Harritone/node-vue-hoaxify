const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const SMTPServer = require('smtp-server').SMTPServer;
const en = require('../locales/en/translation.json');
const ru = require('../locales/ru/translation.json');

let lastMail, server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on('data', (data) => {
        mailBody += data.toString();
      });

      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const error = new Error('Invalid mailbox');
          error.responseCode = 553;
          return callback(error);
        }
        lastMail = mailBody;
        callback();
      });
    },
  });

  await server.listen(8587, 'localhost');
  await sequelize.sync();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  simulateSmtpFailure = false;
  await User.destroy({ truncate: true });
});

const validUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
};

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post('/api/v1/users');
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  return agent.send(user);
};

describe('User Registration', () => {
  it('returns 200 OK when signup is valid', async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it('returns success message when signup is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe(en.user_created);
  });

  it('saves user to database', async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('saves the username and email to database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });

  it('hashes the password in database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe('P4ssword');
  });

  it('returns 400 when username is null', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword',
    });
    expect(response.status).toBe(400);
  });

  it('returns validation errors field in response body when validation errors occures', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword',
    });
    const { body } = response;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it('returns errors for both when username and email are null', async () => {
    const response = await postUser({
      username: null,
      email: null,
      password: 'P4ssword',
    });

    const { body } = response;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it.each`
    field         | value              | message
    ${'username'} | ${null}            | ${en.blank}
    ${'username'} | ${'usr'}           | ${en.username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${en.username_size}
    ${'email'}    | ${null}            | ${en.blank}
    ${'email'}    | ${'mail.com'}      | ${en.not_valid}
    ${'email'}    | ${'user.mail.com'} | ${en.not_valid}
    ${'email'}    | ${'user@mail'}     | ${en.not_valid}
    ${'password'} | ${null}            | ${en.blank}
    ${'password'} | ${'p4ssw'}         | ${en.password_size}
    ${'password'} | ${'alllowercvase'} | ${en.password_chars}
    ${'password'} | ${'ALLUPPERCASE'}  | ${en.password_chars}
    ${'password'} | ${'lowerUPPER'}    | ${en.password_chars}
    ${'password'} | ${'lower44343'}    | ${en.password_chars}
    ${'password'} | ${'UPPER44343'}    | ${en.password_chars}
  `('returns $message when $field is $value', async ({ field, message, value }) => {
    const user = {
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    };
    user[field] = value;
    const { body } = await postUser(user);
    expect(body.validationErrors[field]).toBe(message);
  });

  it(`returns email ${en.been_taken} when the same email already taken`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser(validUser);
    expect(body.validationErrors.email).toBe(en.been_taken);
  });

  it(`returns errors for both username ${en.blank} and email ${en.been_taken}`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser({
      username: null,
      email: validUser.email,
      password: 'P4ssword',
    });

    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it('creates user in inactive mode', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates user in inactive mode even the request body contains inactive as false', async () => {
    const newUser = { ...validUser, inactive: false };
    await postUser(newUser);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates an activation token for user', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it('sends an account activation email with activation token', async () => {
    await postUser();

    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain(validUser.email);
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.status).toBe(502);
  });

  it('returns email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe('Email Failure');
  });

  it('does not save user to db when activation email fails', async () => {
    simulateSmtpFailure = true;
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });

  it('returns validation failure message in error response body when validation failes', async () => {
    const response = await postUser({
      username: null,
      email: validUser.email,
      password: validUser.password,
    });

    expect(response.body.message).toBe('Validation Failure');
  });
});

describe('Internationalization', () => {
  it.each`
    field         | value              | message
    ${'username'} | ${null}            | ${ru.blank}
    ${'username'} | ${'usr'}           | ${ru.username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${ru.username_size}
    ${'email'}    | ${null}            | ${ru.blank}
    ${'email'}    | ${'mail.com'}      | ${ru.not_valid}
    ${'email'}    | ${'user.mail.com'} | ${ru.not_valid}
    ${'email'}    | ${'user@mail'}     | ${ru.not_valid}
    ${'password'} | ${null}            | ${ru.blank}
    ${'password'} | ${'p4ssw'}         | ${ru.password_size}
    ${'password'} | ${'alllowercvase'} | ${ru.password_chars}
    ${'password'} | ${'ALLUPPERCASE'}  | ${ru.password_chars}
    ${'password'} | ${'lowerUPPER'}    | ${ru.password_chars}
    ${'password'} | ${'lower44343'}    | ${ru.password_chars}
    ${'password'} | ${'UPPER44343'}    | ${ru.password_chars}
  `('returns $message when $field is $value when language is Russian', async ({ field, message, value }) => {
    const user = {
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    };
    user[field] = value;
    const { body } = await postUser(user, { language: 'ru' });
    expect(body.validationErrors[field]).toBe(message);
  });

  it(`returns email ${ru.been_taken} when the same email already taken when language is Russian`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser({ ...validUser }, { language: 'ru' });
    expect(body.validationErrors.email).toBe(ru.been_taken);
  });

  it(`returns errors for both username ${ru.blank} and email ${ru.been_taken}`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser({ ...validUser, username: null }, { language: 'ru' });
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it(`returns success message of ${ru.user_created} when signup request is valid and language is Russian`, async () => {
    const {
      body: { message },
    } = await postUser(validUser, { language: 'ru' });
    expect(message).toBe(ru.user_created);
  });

  it(`returns "${ru.email_failure}" message when sending email fails`, async () => {
    simulateSmtpFailure = true;
    const response = await postUser({ ...validUser }, { language: 'ru' });
    expect(response.body.message).toBe(ru.email_failure);
  });

  it(`returns ${ru.validation_failure} message when sending email fails and language is Russian`, async () => {
    const response = await postUser(
      {
        username: null,
        email: validUser.email,
        password: validUser.password,
      },
      { language: 'ru' }
    );

    expect(response.body.message).toBe(ru.validation_failure);
  });
});

describe('Account activation', () => {
  it('activates the account when correct token is sent', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app).post(`/api/v1/users/token/${token}`).send();

    users = await User.findAll();
    expect(users[0].inactive).toBe(false);
  });

  it('removes the token from user table after successful activation', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app).post(`/api/v1/users/token/${token}`).send();

    users = await User.findAll();
    expect(users[0].activationToken).toBeFalsy();
  });

  it('does not activate when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-fit';

    await request(app).post(`/api/v1/users/token/${token}`).send();

    const users = await User.findAll();
    expect(users[0].inactive).toBe(true);
  });

  it('returns bad request when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-fit';

    const response = await request(app).post(`/api/v1/users/token/${token}`).send();

    expect(response.status).toBe(400);
  });

  it.each`
    language | tokenStatus  | message
    ${'ru'}  | ${'wrong'}   | ${ru.account_activation_failure}
    ${'en'}  | ${'wrong'}   | ${en.account_activation_failure}
    ${'ru'}  | ${'correct'} | ${ru.account_activation_success}
    ${'en'}  | ${'correct'} | ${en.account_activation_success}
  `(
    'return $message when wrong token is $tokenStatus and language is $language',
    async ({ language, tokenStatus, message }) => {
      await postUser();
      let token = 'this-token-does-not-fit';
      if (tokenStatus === 'correct') {
        const users = await User.findAll();
        token = users[0].activationToken;
      }

      const agent = request(app).post(`/api/v1/users/token/${token}`);
      agent.set('Accept-Language', language);

      const response = await agent.send();

      expect(response.body.message).toBe(message);
    }
  );
});

describe('Error Model', () => {
  it('returns path, timestamp, message and validationErrors in response when falidation failure', async () => {
    const response = await postUser({ ...validUser, username: null });
    const body = response.body;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message', 'validationErrors']);
  });

  it('returns path, timestamp and message in  response when request fails other than validation errors', async () => {
    const token = 'this-token-does-not-fit';

    const response = await request(app).post(`/api/v1/users/token/${token}`).send();
    const body = response.body;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message']);
  });

  it('returns path in error body', async () => {
    const token = 'this-token-does-not-fit';
    const path = `/api/v1/users/token/${token}`;
    const response = await request(app).post(path).send();
    const body = response.body;
    expect(body.path).toEqual(path);
  });

  it('returns timestamp in miliseconds within 5 seconds value in error body', async () => {
    const timeNow = new Date().getTime();
    const fiveSecondsLater = timeNow + 5 * 1000;
    const token = 'this-token-does-not-fit';
    const path = `/api/v1/users/token/${token}`;
    const response = await request(app).post(path).send();
    const body = response.body;
    expect(body.timestamp).toBeGreaterThan(timeNow);
    expect(body.timestamp).toBeLessThan(fiveSecondsLater);
  });
});
