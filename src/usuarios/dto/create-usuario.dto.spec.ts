import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUsuarioDto } from './create-usuario.dto';

const validPayload = {
  identityUserId: 'local-test-identity-user-id',
  rolId: '550e8400-e29b-41d4-a716-446655440000',
  rut: '77.777.777-7',
  nombres: 'Usuario',
  apellidos: 'Local',
  email: 'usuario.local@correo.cl',
  telefono: '+56977777777',
  activo: true,
};

const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CreateUsuarioDto, payload));

describe('CreateUsuarioDto', () => {
  it('accepts required local user fields', async () => {
    const errors = await validateDto(validPayload);

    expect(errors).toHaveLength(0);
  });

  it('rejects payload without required fields', async () => {
    const errors = await validateDto({});
    const properties = errors.map(error => error.property);

    expect(properties).toEqual(
      expect.arrayContaining([
        'identityUserId',
        'rolId',
        'rut',
        'nombres',
        'apellidos',
        'email',
      ]),
    );
  });

  it('rejects invalid email and role id', async () => {
    const errors = await validateDto({
      ...validPayload,
      rolId: 'rol-invalido',
      email: 'correo-invalido',
    });
    const properties = errors.map(error => error.property);

    expect(properties).toEqual(expect.arrayContaining(['rolId', 'email']));
  });
});
