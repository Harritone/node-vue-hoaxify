const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
const en = require('../locales/en/translation.json');
const ru = require('../locales/ru/translation.json');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
});

const auth = async (options = {}) => {
  let token;
  if (options.auth) {
    const response = await request(app).post('/api/v1/auth').send(options.auth);
    token = response.body.token;
  }
  return token;
};

const deleteUser = async (id = 5, options = {}) => {
  const agent = request(app).delete(`/api/v1/users/${id}`);
  if (options.language) agent.set('Accept-Language', options.language);
  if (options.token) agent.set('Authorization', `Bearer ${options.token}`);
  return await agent.send();
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

describe('User Delete', () => {
  it('returns forbidden when request sent anauthorized', async () => {
    const response = await deleteUser();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'en'}  | ${en.unauthorized_user_delete}
    ${'ru'}  | ${ru.unauthorized_user_delete}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async ({ language, message }) => {
      const nowInMillis = new Date().getTime();
      const response = await deleteUser(5, { language: language });
      // const response = await request(app).put('/api/v1/users/5').set('Accept-Language', language).send();
      const error = response.body;
      expect(error.path).toBe('/api/v1/users/5');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
      expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
      expect(error.message).toBe(message);
    }
  );

  it('returns forbidden when delete request sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeDeleted = await addUser({ ...activeUser, username: 'user2', email: 'user2@mail.com' });
    const token = await auth({
      auth: { email: 'user1@email.com', password: 'P4ssword' },
    });
    const response = await deleteUser(userToBeDeleted.id, {
      token: token,
    });
    expect(response.status).toBe(403);
  });

  it('returns 403 when token is not valid', async () => {
    const response = await deleteUser(5, { token: 'invalid_token' });
    expect(response.status).toBe(403);
  });

  it('returns 200 ok when valid delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({ auth: { email: 'user1@mail.com', password: 'P4ssword' } });
    const response = await deleteUser(savedUser.id, {
      token: token,
    });
    expect(response.status).toBe(200);
  });

  it('deletes username in db when valid update request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({ auth: { email: 'user1@mail.com', password: 'P4ssword' } });
    await deleteUser(savedUser.id, { token: token });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser).toBeNull();
  });
});
