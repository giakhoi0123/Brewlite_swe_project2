import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'Token không hợp lệ' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu phải có ít nhất một chữ hoa' })
  @Matches(/[0-9]/, { message: 'Mật khẩu phải có ít nhất một chữ số' })
  newPassword!: string;
}
