import { container, server } from '../src/dispatcher';
import { CreateUserDto } from '../src/dto/create-user.dto';
import { UserController } from '../src/router';

describe('server', () => {
  let spies: jest.SpyInstance[] = [];

  beforeAll(async () => {
    await new Promise<void>(resolve => {
      if (server.listening) {
        resolve();
      } else {
        server.once('listening', resolve);
      }
    });
  });

  describe('unknown route', () => {
    test.each(['/user', '/users/user/42'])('should return 404 for %s', async (path) => {
      const response = await fetch(`http://localhost:3000${path}`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toEqual({ error: 'Not Found' });
    });
  });

  describe('GET /users', () => {
    it('should return all users by default', async () => {
      const response = await fetch('http://localhost:3000/users');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(11);
    });

    it('should return a limited number of users if a limit is provided', async () => {
      const response = await fetch('http://localhost:3000/users?limit=5');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(5);
    });

    it('should call UserController.getUsers with the limit if provided', async () => {
      const getUsersSpy = jest.spyOn(container.resolve(UserController), 'getUsers');
      spies.push(getUsersSpy);
      await fetch('http://localhost:3000/users?limit=5');
      expect(getUsersSpy).toHaveBeenCalledWith(5);
    });

    test.each(['invalid', '0'])('should return 400 if the limit is "%s"', async (limit) => {
      const response = await fetch(`http://localhost:3000/users?limit=${limit}`);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual([{ property: 'limit', constraints: { isPositiveInt: 'Must be a positive integer' } }]);
    });
  });

  describe('GET /users/:id', () => {
    it('should return 400 if the id is invalid', async () => {
      const response = await fetch('http://localhost:3000/users/invalid');
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual([{ property: 'id', constraints: { isPositiveInt: 'Must be a positive integer' } }]);
    });

    it('should return null if the user does not exist', async () => {
      const response = await fetch('http://localhost:3000/users/666');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toBeNull();
    });

    it('should return the user if it exists', async () => {
      const response = await fetch('http://localhost:3000/users/42');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: 42, name: 'Jane Doe', email: 'jane.doe@example.com', age: 21 });
    });

    it('should call UserController.getUser with the id', async () => {
      const getUserSpy = jest.spyOn(container.resolve(UserController), 'getUser');
      spies.push(getUserSpy);
      await fetch('http://localhost:3000/users/42');
      expect(getUserSpy).toHaveBeenCalledWith(42);
    });
  });

  describe('POST /users', () => {
    const validBody = { name: 'John Doe', email: 'john.doe@example.com', age: 16 };

    it('should respond with error code 400 and all missing fields if the body is an empty object', async () => {
      const response = await fetch('http://localhost:3000/users', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual([
        {
          property: 'name',
          constraints: {
            isString: 'name must be a string',
            minLength: 'name must be longer than or equal to 2 characters'
          }
        },
        { property: 'email', constraints: { isEmail: 'email must be an email' } },
        {
          property: 'age',
          constraints: { isInt: 'age must be an integer number', min: 'age must not be less than 16' }
        }
      ]);
    });

    test.each([
      {
        reqBody: { ...validBody, name: 'J' },
        resBody: [{ property: 'name', constraints: { minLength: 'name must be longer than or equal to 2 characters' } }]
      },
      {
        reqBody: { ...validBody, email: 'invalid' },
        resBody: [{ property: 'email', constraints: { isEmail: 'email must be an email' } }]
      },
      {
        reqBody: { ...validBody, age: 15 },
        resBody: [{ property: 'age', constraints: { min: 'age must not be less than 16' } }]
      }
    ])(
      'should respond with error code 400 and an error for invalid field "$resBody[0].name$"',
      async ({ reqBody, resBody }) => {
        const response = await fetch('http://localhost:3000/users', {
          method: 'POST',
          body: JSON.stringify(reqBody),
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body).toEqual(resBody);
      }
    );

    it('should return a new user if the body is valid', async () => {
      const response = await fetch('http://localhost:3000/users', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      expect(response.status).toBe(200);
      const { id, ...restProps } = await response.json();
      expect(id).toBeGreaterThan(0);
      expect(restProps).toEqual(validBody);
    });

    it('should call UserController.addUser with CreateUserDto instance', async () => {
      const addUserSpy = jest.spyOn(container.resolve(UserController), 'addUser');
      spies.push(addUserSpy);
      await fetch('http://localhost:3000/users', {
        method: 'POST',
        body: JSON.stringify(validBody)
      });
      expect(addUserSpy).toHaveBeenCalledWith(expect.any(CreateUserDto));
    })
  });

  afterEach(() => {
    if (spies.length > 0) {
      spies.forEach(spy => spy.mockRestore());
      spies = [];
    }
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
});
