const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
const en = require('../locales/en/translation.json');
const ru = require('../locales/ru/translation.json');
const expectExport = require('expect');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
});

const putUser = async (id = 5, body = null, options = {}) => {
  const agent = request(app).put(`/api/v1/users/${id}`);
  if (options.language) agent.set('Accept-Language', options.language);
  if (options.auth) {
    const { email, password } = options.auth;
    agent.auth(email, password);
    // const merged = `${email}:${password}`;
    // const base64 = Buffer.from(merged).toString('base64');
    // agent.set('Authorization', `Basic ${base64}`);
  }
  return await agent.send(body);
};

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
  inactive: false,
};

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};

describe('User Update', () => {
  it('returns forbidden when request sent without basic authorization', async () => {
    const response = await putUser();
    expectExport(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'en'}  | ${en.unauthorized_user_update}
    ${'ru'}  | ${ru.unauthorized_user_update}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async ({ language, message }) => {
      const nowInMillis = new Date().getTime();
      const response = await putUser(5, null, { language: language });
      // const response = await request(app).put('/api/v1/users/5').set('Accept-Language', language).send();
      const error = response.body;
      expect(error.path).toBe('/api/v1/users/5');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
      expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
      expect(error.message).toBe(message);
    }
  );

  it('returns forbidden when request sent with incorrect email in basic authorization', async () => {
    const user = await addUser();
    const response = await putUser(user.id, null, { auth: { email: 'user1000@mail.com', password: 'P4ssword' } });
    expect(response.status).toBe(403);
  });

  it('returns forbidden when request sent with incorrect password in basic authorization', async () => {
    const user = await addUser();
    const response = await putUser(user.id, null, { auth: { email: 'user1@mail.com', password: 'Password' } });
    expect(response.status).toBe(403);
  });

  it('returns forbidden when update request sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeUpdated = await addUser({ ...activeUser, username: 'user2', email: 'user2@mail.com' });
    const response = await putUser(userToBeUpdated.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    expect(response.status).toBe(403);
  });

  it('returns forbidden when update request sent by inactive user with correct credentials', async () => {
    const user = await addUser({ ...activeUser, inactive: true });
    const response = await putUser(user.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    expect(response.status).toBe(403);
  });
});
