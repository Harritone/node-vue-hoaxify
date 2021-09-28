const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const validUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
};

const postUser = (user) => {
  return request(app).post('/api/v1/users').send(user);
};

describe('User Registration', () => {
  it('returns 200 OK when signup is valid', async () => {
    const response = await postUser(validUser);
    expect(response.status).toBe(200);
  });

  it('returns success message when signup is valid', async () => {
    const response = await postUser(validUser);
    expect(response.body.message).toBe('User created');
  });

  it('saves user to database', async () => {
    await postUser(validUser);
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('saves the username and email to database', async () => {
    await postUser(validUser);
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });

  it('hashes the password in database', async () => {
    await postUser(validUser);
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

  // it.each([
  //   ['username', 'Username cannot be null'],
  //   ['email', 'Email cannot be null'],
  //   ['password', 'Password cannot be null'],
  // ])('when %s is null $s is received', async (field, message) => {
  //   const user = {
  //     username: 'user1',
  //     email: 'user1@mail.com',
  //     password: 'P4ssword',
  //   };
  //   user[field] = null;
  //   const {body} = await postUser(user);
  //   expect(body.validationErrors[field]).toBe(message);
  // });

  const blank = 'cannot be blank';
  const username_size = 'must have min 4 and max 32 characters';
  const not_valid = 'is not valid';
  const password_size = 'must be at least 6 characters';
  const password_chars = 'must have at least 1 uppercase, 1 lowercase letter and 1 number';
  const been_taken = 'has already been taken';

  it.each`
    field         | value              | message
    ${'username'} | ${null}            | ${blank}
    ${'username'} | ${'usr'}           | ${username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${username_size}
    ${'email'}    | ${null}            | ${blank}
    ${'email'}    | ${'mail.com'}      | ${not_valid}
    ${'email'}    | ${'user.mail.com'} | ${not_valid}
    ${'email'}    | ${'user@mail'}     | ${not_valid}
    ${'password'} | ${null}            | ${blank}
    ${'password'} | ${'p4ssw'}         | ${password_size}
    ${'password'} | ${'alllowercvase'} | ${password_chars}
    ${'password'} | ${'ALLUPPERCASE'}  | ${password_chars}
    ${'password'} | ${'lowerUPPER'}    | ${password_chars}
    ${'password'} | ${'lower44343'}    | ${password_chars}
    ${'password'} | ${'UPPER44343'}    | ${password_chars}
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

  it(`returns email ${been_taken} when the same email already taken`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser(validUser);
    expect(body.validationErrors.email).toBe(been_taken);
  });

  it(`returns errors for both username ${blank} and email ${been_taken}`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser({
      username: null,
      email: validUser.email,
      password: 'P4ssword',
    });

    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });
});

describe('Internationalization', () => {
  const blank = 'не может быть пустым';
  const username_size = 'должен быть мин 4 и макс 32 знака';
  const not_valid = 'не валидный';
  const password_size = 'должен быть минимум 4 знака';
  const password_chars = 'должен содержать 1 заглавную 1 рописную буквы и 1 цифру';
  const been_taken = 'уже занят';
  const postUser = (user) => {
    return request(app).post('/api/v1/users').set('Accept-Language', 'ru').send(user);
  };

  it.each`
    field         | value              | message
    ${'username'} | ${null}            | ${blank}
    ${'username'} | ${'usr'}           | ${username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${username_size}
    ${'email'}    | ${null}            | ${blank}
    ${'email'}    | ${'mail.com'}      | ${not_valid}
    ${'email'}    | ${'user.mail.com'} | ${not_valid}
    ${'email'}    | ${'user@mail'}     | ${not_valid}
    ${'password'} | ${null}            | ${blank}
    ${'password'} | ${'p4ssw'}         | ${password_size}
    ${'password'} | ${'alllowercvase'} | ${password_chars}
    ${'password'} | ${'ALLUPPERCASE'}  | ${password_chars}
    ${'password'} | ${'lowerUPPER'}    | ${password_chars}
    ${'password'} | ${'lower44343'}    | ${password_chars}
    ${'password'} | ${'UPPER44343'}    | ${password_chars}
  `('returns $message when $field is $value when language is Russian', async ({ field, message, value }) => {
    const user = {
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    };
    user[field] = value;
    const { body } = await postUser(user);
    expect(body.validationErrors[field]).toBe(message);
  });

  it(`returns email ${been_taken} when the same email already taken when language is Russian`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser(validUser);
    expect(body.validationErrors.email).toBe(been_taken);
  });

  it(`returns errors for both username ${blank} and email ${been_taken}`, async () => {
    await User.create({ ...validUser });
    const { body } = await postUser({
      username: null,
      email: validUser.email,
      password: 'P4ssword',
    });

    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });
});
