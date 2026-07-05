import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { validarRut } from '../lib/rut.util';

@ValidatorConstraint({ name: 'isRutValido', async: false })
export class IsRutValidoConstraint implements ValidatorConstraintInterface {
  validate(rut: string) {
    if (!rut) return true; // dejar pasar si es opcional
    return validarRut(rut);
  }

  defaultMessage() {
    return 'RUT no es válido (dígito verificador incorrecto)';
  }
}

export function IsRutValido(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRutValidoConstraint,
    });
  };
}
