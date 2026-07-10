import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePacienteDto } from './create-paciente.dto';

const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CreatePacienteDto, payload));

describe('CreatePacienteDto', () => {
  it('accepts required patient registration fields', async () => {
    const errors = await validateDto({
      rut: '11.111.111-1',
      nombres: 'Ana',
      apellidos: 'Lopez',
      fechaNacimiento: '1980-01-20',
      sexo: 'FEMENINO',
      telefono: '+56911111111',
      email: 'ana.lopez@correo.cl',
      direccion: 'Calle Principal 123',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects payload without rut, nombres or apellidos', async () => {
    const errors = await validateDto({});
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining(['rut', 'nombres', 'apellidos']),
    );
  });

  it('rejects invalid email', async () => {
    const errors = await validateDto({
      rut: '11.111.111-1',
      nombres: 'Ana',
      apellidos: 'Lopez',
      email: 'correo-invalido',
    });

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });
});
