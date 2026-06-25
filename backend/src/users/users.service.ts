import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import type { UserSafe } from './types/user-safe.type';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(data: {
    email: string;
    passwordHash: string;
    username: string;
    timezone: string;
  }): Promise<UserDocument> {
    try {
      const user = new this.userModel(data);
      return await user.save();
    } catch (err: unknown) {
      if (this.isDuplicateKeyError(err)) {
        const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {};
        if (keyValue['email']) throw new ConflictException('Email already registered');
        if (keyValue['username']) throw new ConflictException('Username already taken');
      }
      throw err;
    }
  }

  async findByEmailWithHash(email: string): Promise<UserDocument | null> {
    // passwordHash is select:false — must explicitly include it here
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $inc: { failedLoginAttempts: 1 } })
      .exec();
  }

  async lockAccount(userId: string, until: Date): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        lockUntil: until,
        failedLoginAttempts: 0,
      })
      .exec();
  }

  async resetLoginAttempts(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        failedLoginAttempts: 0,
        lockUntil: null,
      })
      .exec();
  }

  toSafe(user: UserDocument): UserSafe {
    return {
      userId: (user._id as { toString(): string }).toString(),
      email: user.email,
      username: user.username,
      timezone: user.timezone,
      createdAt: (user as unknown as { createdAt: Date }).createdAt.toISOString(),
    };
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    );
  }
}
