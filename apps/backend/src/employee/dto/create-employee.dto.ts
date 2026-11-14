import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  fullName: string;

  @IsString()
  employeeNumber: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsUUID()
  jobTypeId: string;
}
