export class AuditableEntity {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;

  static keys = (): string[] => [
    'createdBy',
    'createdAt',
    'updatedBy',
    'updatedAt',
  ];
}
