import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { OrganizationUnit, UnitLevel } from '../database/entities/organization-unit.entity';
import { User } from '../database/entities/user.entity';
import { CreateOrganizationUnitDto, UpdateOrganizationUnitDto } from './organization.dto';
import { AuditLog } from '../database/entities/audit-log.entity';

@Injectable()
export class OrganizationService {
  constructor(private readonly em: EntityManager) {}

  async getTree(userEmail: string) {
    const user = await this.em.findOne(User, { email: userEmail }, { populate: ['orgUnit'] as any });
    if (!user) throw new NotFoundException('User not found');

    // Scoped RBAC logic: Nếu không có unitAdminLevel nhưng cũng không có orgUnit -> Super Admin (BO)
    const adminLevel = user.unitAdminLevel || (!user.orgUnit ? UnitLevel.BO : null);
    
    // Nếu là admin cấp Bộ hoặc SuperAdmin không bị giới hạn orgUnit -> Lấy toàn bộ cây
    if (adminLevel === UnitLevel.BO || !user.orgUnit) {
      const allUnits = await this.em.find(OrganizationUnit, {}, { orderBy: { level: 'ASC', name: 'ASC' } });
      return this.buildTree(allUnits);
    }

    // Nếu là admin cấp Đơn Vị (Vụ/Cục) -> Chỉ lấy Đơn vị của họ và các phòng trực thuộc
    if (adminLevel === UnitLevel.DON_VI) {
      if (!user.orgUnit) return []; // An toàn

      const orgs = await this.em.find(OrganizationUnit, {
        $or: [
          { id: user.orgUnit.id }, // Chính Đơn vị đó
          { parent: user.orgUnit.id } // Các phòng trực thuộc Đơn vị
        ]
      }, { orderBy: { level: 'ASC', name: 'ASC' } });
      
      return this.buildTree(orgs);
    }

    // Nếu là Cấp Phòng Ban hoặc Nhân viên bình thường -> Có thể trả về rỗng hoặc chỉ thông tin phòng ban hiện tại
     if (adminLevel === UnitLevel.PHONG_BAN) {
        if (!user.orgUnit) return [];
        const orgs = await this.em.find(OrganizationUnit, { id: user.orgUnit.id });
        return this.buildTree(orgs);
     }

    return [];
  }

  private buildTree(units: OrganizationUnit[]): any[] {
    const unitMap = new Map();
    const tree: any[] = [];

    // Khởi tạo map
    units.forEach(unit => {
      unitMap.set(unit.id, { ...unit, children: [] });
    });

    // Lắp ráp cây
    units.forEach(unit => {
      const node = unitMap.get(unit.id);
      if (unit.parent) {
         // Nếu parent có trong mảng trả về (vì có thể query bị cắt nhánh)
         const parentNode = unitMap.get(unit.parent.id);
         if (parentNode) {
            parentNode.children.push(node);
         } else {
            tree.push(node); // Nếu cha không load được, tự lên rễ
         }
      } else {
        tree.push(node);
      }
    });

    return tree;
  }

  async create(dto: CreateOrganizationUnitDto, adminEmail: string) {
    const adminUser = await this.em.findOne(User, { email: adminEmail }, { populate: ['orgUnit'] as any });
    if (!adminUser) throw new NotFoundException('User not found');

    const adminLevel = adminUser.unitAdminLevel || (!adminUser.orgUnit ? UnitLevel.BO : null);

    // Xác thực quyền:
    if (adminLevel !== UnitLevel.BO && adminLevel !== UnitLevel.DON_VI) {
      throw new ForbiddenException('Bạn không có quyền tạo đơn vị.');
    }

    let parentUnit: OrganizationUnit | null = null;

    if (dto.parentId) {
      parentUnit = await this.em.findOne(OrganizationUnit, { id: dto.parentId });
      if (!parentUnit) throw new NotFoundException('Đơn vị cha không tồn tại');
      
      // Admin Đơn vị chỉ được phép tạo Phòng ban dưới Đơn vị của mình
      if (adminLevel === UnitLevel.DON_VI) {
         if (parentUnit.id !== adminUser.orgUnit?.id) {
           throw new ForbiddenException('Bạn chỉ được tạo Phòng ban trực thuộc Đơn vị của mình.');
         }
         if (dto.level !== UnitLevel.PHONG_BAN) {
           throw new BadRequestException('Bạn chỉ được phép tạo Cấp Phòng Ban.');
         }
      }

      // Logic Cấp bậc cố định
      if (dto.level === UnitLevel.BO && parentUnit) {
         throw new BadRequestException('Cấp Bộ phải là cấp cao nhất (Không có cha).');
      }
      if (dto.level === UnitLevel.DON_VI && parentUnit.level !== UnitLevel.BO) {
         throw new BadRequestException('Cấp Đơn vị (Cục/Vụ) phải thuộc trực tiếp cấp Bộ.');
      }
      if (dto.level === UnitLevel.PHONG_BAN && parentUnit.level !== UnitLevel.DON_VI) {
         throw new BadRequestException('Cấp Phòng ban phải thuộc trực tiếp cấp Đơn vị (Cục/Vụ).');
      }
    } else {
      // Không có parent
      if (dto.level !== UnitLevel.BO) {
        throw new BadRequestException('Chỉ Cấp Bộ mới được phép không có đơn vị cha.');
      }
      if (adminLevel !== UnitLevel.BO) {
        throw new ForbiddenException('Bạn không có quyền tạo cấp Bộ.');
      }
    }

    const newUnit = this.em.create(OrganizationUnit, {
      name: dto.name,
      code: dto.code || undefined,
      level: dto.level,
      parent: parentUnit || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    await this.em.persistAndFlush(newUnit);

    const audit = this.em.create(AuditLog, {
      collection: 'organization_units',
      targetId: newUnit.id,
      action: 'CREATE',
      userEmail: adminEmail,
      details: { name: dto.name, level: dto.level },
      timestamp: new Date(),
    });

    await this.em.persistAndFlush(audit);
    return newUnit;
  }

  async update(id: string, dto: UpdateOrganizationUnitDto, adminEmail: string) {
    const unit = await this.em.findOne(OrganizationUnit, { id }, { populate: ['parent'] as any });
    if (!unit) throw new NotFoundException('Không tìm thấy đơn vị.');

    const adminUser = await this.em.findOne(User, { email: adminEmail }, { populate: ['orgUnit'] as any });
    const adminLevel = adminUser ? (adminUser.unitAdminLevel || (!adminUser.orgUnit ? UnitLevel.BO : null)) : null;

    // Phân quyền sửa
    if (adminLevel === UnitLevel.DON_VI) {
       // UnitAdmin chỉ được sửa phòng ban của mình hoặc sửa Đơn vị của chính mình
       const isSelf = unit.id === adminUser?.orgUnit?.id;
       const isChild = unit.parent?.id === adminUser?.orgUnit?.id;
       if (!isSelf && !isChild) {
          throw new ForbiddenException('Bạn không có thẩm quyền sửa đơn vị này.');
       }
    } else if (adminLevel !== UnitLevel.BO) {
       throw new ForbiddenException('Bạn không có quyền sửa đổi cơ cấu.');
    }

    if (dto.name) unit.name = dto.name;
    if (dto.code) unit.code = dto.code;
    unit.updatedAt = new Date();

    const audit = this.em.create(AuditLog, {
      collection: 'organization_units',
      targetId: unit.id,
      action: 'UPDATE',
      userEmail: adminEmail,
      details: dto,
      timestamp: new Date(),
    });

    await this.em.persistAndFlush([unit, audit]);
    return unit;
  }

  async remove(id: string, adminEmail: string) {
    const unit = await this.em.findOne(OrganizationUnit, { id }, { populate: ['children'] as any });
    if (!unit) throw new NotFoundException('Không tìm thấy đơn vị.');

    if (unit.children.length > 0) {
      throw new BadRequestException('Không thể xoá đơn vị đang có đơn vị con. Hãy dọn dẹp đơn vị con trước.');
    }

    const adminUser = await this.em.findOne(User, { email: adminEmail }, { populate: ['orgUnit'] as any });
    const adminLevel = adminUser ? (adminUser.unitAdminLevel || (!adminUser.orgUnit ? UnitLevel.BO : null)) : null;

    // Phân quyền sửa
    if (adminLevel === UnitLevel.DON_VI) {
       // UnitAdmin chỉ được xóa phòng ban của đơn vị mình
       if (unit.parent?.id !== adminUser?.orgUnit?.id) {
          throw new ForbiddenException('Bạn không có quyền xóa đơn vị này.');
       }
    } else if (adminLevel !== UnitLevel.BO) {
       throw new ForbiddenException('Bạn không có quyền xóa cơ cấu tổ chức.');
    }

    // TODO: Cần kiểm tra xem có User hoặc SharedMailbox nào đang thuộc về Unit này nữa không.
    // Tạm thời bỏ qua hoặc throw Error nếu có entity liên quan.
    const usersCount = await this.em.count(User, { orgUnit: id });
    const mailboxesCount = await this.em.count('SharedMailbox', { orgUnit: id }); // Tránh circular depend

    if (usersCount > 0 || mailboxesCount > 0) {
       throw new BadRequestException('Đang có Tài khoản User hoặc Mailbox dùng chung thuộc Đơn vị này. Không thể xóa.');
    }

    const audit = this.em.create(AuditLog, {
      collection: 'organization_units',
      targetId: unit.id,
      action: 'DELETE',
      userEmail: adminEmail,
      details: { name: unit.name },
      timestamp: new Date(),
    });

    await this.em.begin();
    try {
      this.em.remove(unit);
      await this.em.persistAndFlush(audit);
      await this.em.commit();
      return { success: true };
    } catch (e) {
      await this.em.rollback();
      throw new BadRequestException('Không thể xoá vào lúc này.');
    }
  }

  // --- Users & Mailbox scoped management ---

  async searchUsers(query: string, adminEmail: string) {
    if (!query || query.length < 2) return [];

    const adminUser = await this.em.findOne(User, { email: adminEmail }, { populate: ['orgUnit'] as any });
    // Nếu có Scoped Role, trong tương lai có thể chặn search ra người ngoại bang. Hiện tại Admin được phép search email.
    
    const users = await this.em.find(User, {
       email: { $ilike: `%${query}%` }
    }, { limit: 20 });
    
    return users.map(u => ({
       id: u.id,
       email: u.email,
       name: u.name,
       orgUnit: u.orgUnit ? { id: u.orgUnit.id, name: u.orgUnit.name } : null
    }));
  }

  async getUsersByUnit(unitId: string, adminEmail: string, page = 1, pageSize = 10, search?: string) {
    const query: any = { orgUnit: unitId };
    
    // Nếu có search, tìm theo email hoặc tên
    if (search && search.trim() !== '') {
      query.$or = [
        { email: { $ilike: `%${search}%` } },
        { name: { $ilike: `%${search}%` } }
      ];
    }

    const [users, total] = await this.em.findAndCount(User, query, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: { createdAt: 'DESC' } // hoặc orderBy email
    });

    return {
      items: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        unitAdminLevel: u.unitAdminLevel
      })),
      total
    };
  }

  async assignUser(userId: string, unitId: string | null, adminEmail: string) {
    const targetUser = await this.em.findOne(User, { id: userId });
    if (!targetUser) throw new NotFoundException('User không tồn tại');

    const adminUser = await this.em.findOne(User, { email: adminEmail }, { populate: ['orgUnit'] as any });
    // RBAC check: Bạn chỉ có thể gán người dùng vào Unit của bạn hoặc con của bạn.
    
    if (unitId) {
       const unitToAssign = await this.em.findOne(OrganizationUnit, { id: unitId }, { populate: ['parent'] as any });
       if (!unitToAssign) throw new NotFoundException('Organization Unit không tồn tại');
       
       if (adminUser?.unitAdminLevel === UnitLevel.DON_VI) {
          if (unitToAssign.id !== adminUser.orgUnit?.id && unitToAssign.parent?.id !== adminUser.orgUnit?.id) {
             throw new ForbiddenException('Bạn không được gán User sang Tổ chức ngoại bang.');
          }
       }
       targetUser.orgUnit = unitToAssign;
    } else {
       targetUser.orgUnit = undefined;
    }

    const audit = this.em.create(AuditLog, {
      collection: 'users',
      targetId: targetUser.id,
      action: 'UPDATE_ORG_UNIT',
      userEmail: adminEmail,
      details: {
        newOrgUnit: unitId
      },
      timestamp: new Date()
    });

    await this.em.persistAndFlush([targetUser, audit]);
    return { success: true };
  }
}

