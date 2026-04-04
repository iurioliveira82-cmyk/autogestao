import React, { useState } from 'react';
import { 
  Trash2, 
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../auth/Auth';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { AppButton } from '../../components/ui/AppButton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';

const Settings: React.FC<{ setActiveTab?: (tab: string, itemId?: string) => void }> = ({ setActiveTab }) => {
  const { isAdmin, profile } = useAuth();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleResetDatabase = async () => {
    if (!isAdmin) return;

    try {
      const collections = [
        'clients',
        'vehicles',
        'serviceOrders',
        'appointments',
        'inventory',
        'transactions',
        'stockMovements',
        'suppliers',
        'resaleVehicles',
        'fiscalRecords'
      ];

      toast.loading('Limpando banco de dados...', { id: 'reset' });

      for (const collName of collections) {
        const q = query(collection(db, collName), where('empresaId', '==', profile.empresaId));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, collName, d.id)));
        await Promise.all(deletePromises);
      }

      toast.success('Banco de dados zerado com sucesso!', { id: 'reset' });
      setIsResetModalOpen(false);
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao zerar banco de dados.', { id: 'reset' });
    }
  };

  return (
    <PageContainer>
      <PageHeader 
        title="Configurações"
        subtitle="Gerencie as configurações do sistema"
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Configurações' }]}
      />

      <div className="grid grid-cols-1 gap-8">
        {/* Opções Avançadas (Admin) */}
        {isAdmin && (
          <div className="space-y-6">
            <SectionCard 
              title="Opções Avançadas" 
              subtitle="Configurações críticas do sistema"
              icon={<ShieldAlert size={20} className="text-red-600" />}
              className="border-red-100"
            >
              <div className="space-y-6">
                <div className="p-6 bg-red-50 rounded-3xl border border-red-100 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 shrink-0" size={24} />
                    <div>
                      <p className="text-sm font-bold text-red-900">Zona de Perigo</p>
                      <p className="text-xs text-red-700 leading-relaxed mt-1">
                        As ações abaixo são irreversíveis. Tenha certeza absoluta antes de prosseguir.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <AppButton
                      variant="danger"
                      onClick={() => setIsResetModalOpen(true)}
                      className="w-full"
                      icon={<Trash2 size={18} />}
                    >
                      Zerar Banco de Dados
                    </AppButton>
                    <p className="text-[10px] text-center font-bold text-red-400 uppercase tracking-widest">
                      Isso apagará todos os clientes, veículos, OS e transações.
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                  <p className="text-sm font-bold text-slate-900 mb-4">Informações do Sistema</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Versão</span>
                      <span className="text-slate-900">2.4.0-PRO</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Ambiente</span>
                      <span className="text-slate-900">Produção</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Último Backup</span>
                      <span className="text-slate-900">Hoje, 04:00</span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetDatabase}
        title="Zerar Banco de Dados?"
        message="Esta ação é IRREVERSÍVEL. Todos os dados do sistema serão apagados permanentemente. Você tem certeza absoluta?"
        confirmLabel="Sim, Apagar Tudo"
        variant="danger"
      />
    </PageContainer>
  );
};

export default Settings;
