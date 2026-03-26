import { useAuth } from '../components/Auth';
import { UserPermissions } from '../types';

export const usePermissions = (module: keyof UserPermissions) => {
  const { profile, isAdmin } = useAuth();
  
  if (isAdmin) {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true
    };
  }

  const permissions = profile?.permissions?.[module];
  
  return {
    canView: permissions?.view || false,
    canCreate: permissions?.create || false,
    canEdit: permissions?.edit || false,
    canDelete: permissions?.delete || false
  };
};
