import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core'; // Import generic EM
import { Role } from './database/entities/role.entity';
import { Permission } from './database/entities/permission.entity';
import { User } from './database/entities/user.entity';
import * as argon from 'argon2'; // Use 'argon' as a common alias

async function seedPermissionsAndRoles(app: INestApplication) {
  const em = app.get(MikroOrmEntityManager);

  // Define Permissions
  const postActions = ['create', 'read', 'update', 'delete'];
  const permissionsToCreate = [] as Pick<Permission, 'collection' | 'action'>[];
  for (const action of postActions) {
    permissionsToCreate.push({ collection: 'post', action });
  }

  const createdPermissions: Permission[] = [];
  for (const permData of permissionsToCreate) {
    let permission = await em.findOne(Permission, permData);
    if (!permission) {
      permission = em.create(Permission, permData);
      await em.persistAndFlush(permission);
      console.log(
        `Created permission: ${permData.collection}.${permData.action}`,
      );
    } else {
      console.log(
        `Permission already exists: ${permData.collection}.${permData.action}`,
      );
    }
    createdPermissions.push(permission);
  }

  // Find specific permissions for roles
  const postReadPermission = createdPermissions.find(
    (p) => p.collection === 'post' && p.action === 'read',
  );
  const allPostPermissions = createdPermissions.filter(
    (p) => p.collection === 'post',
  );

  // Create Roles
  let adminRole = await em.findOne(Role, { name: 'admin' });
  if (!adminRole) {
    adminRole = em.create(Role, {
      name: 'admin',
      description: 'Administrator with full access to posts',
    });
    for (const perm of allPostPermissions) {
      adminRole.permissions.add(perm);
    }
    await em.persistAndFlush(adminRole);
    console.log('Created role: admin');
  } else {
    // Ensure admin role has all permissions if it already existed but might have been incomplete
    for (const perm of allPostPermissions) {
      if (!adminRole.permissions.contains(perm)) {
        adminRole.permissions.add(perm);
      }
    }
    await em.persistAndFlush(adminRole);
    console.log('Role already exists: admin (permissions updated)');
  }

  let publicRole = await em.findOne(Role, { name: 'public' });
  if (!publicRole) {
    publicRole = em.create(Role, {
      name: 'public',
      description: 'Public user with read-only access to posts',
    });
    if (postReadPermission) {
      publicRole.permissions.add(postReadPermission);
    }
    await em.persistAndFlush(publicRole);
    console.log('Created role: public');
  } else {
    // Ensure public role has read permission if it already existed but might have been incomplete
    if (
      postReadPermission &&
      !publicRole.permissions.contains(postReadPermission)
    ) {
      publicRole.permissions.add(postReadPermission);
    }
    await em.persistAndFlush(publicRole);
    console.log('Role already exists: public (permissions updated)');
  }

  // Create Admin User
  let adminUser = await em.findOne(User, { email: 'admin@example.com' });
  if (!adminUser) {
    const hashedPassword = await argon.hash('adminpassword123'); // IMPORTANT: Change this in production!
    adminUser = em.create(User, {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    adminUser.roles.add(adminRole);
    await em.persistAndFlush(adminUser);
    console.log('Created admin user: admin@example.com');
  } else {
    // Ensure admin user has admin role if it already existed but might have been incomplete
    if (!adminUser.roles.contains(adminRole)) {
      adminUser.roles.add(adminRole);
      await em.persistAndFlush(adminUser);
      console.log(
        'Admin user already exists: admin@example.com (role updated)',
      );
    } else {
      console.log('Admin user already exists: admin@example.com');
    }
  }

  console.log('RBAC Seeding complete!');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (validationErrors) => {
        const errors = {};

        for (const err of validationErrors) {
          const field = err.property;
          const messages = Object.values(err.constraints || {});
          errors[field] = messages.length === 1 ? messages[0] : messages;
        }

        return new BadRequestException({
          errors,
        });
      },
    }),
  );

  // Only run seeding in development or when explicitly enabled
  // IMPORTANT: Remove or secure this in production environments!
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.RUN_SEEDING === 'true'
  ) {
    // await seedPermissionsAndRoles(app);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
