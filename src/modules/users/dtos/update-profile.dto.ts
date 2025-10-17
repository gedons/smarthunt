import {
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
  IsObject,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;
}
