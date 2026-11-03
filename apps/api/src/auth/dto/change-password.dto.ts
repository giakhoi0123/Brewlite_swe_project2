import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Mật khẩu hiện tại không được để trống' })
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu mới phải có ít nhất một chữ hoa' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải có ít nhất một chữ số' })
  newPassword!: string;
}
