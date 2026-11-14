import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage } from '../useAsyncRequest';

export interface Member_Profile {
  name: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  taxNumber: string | null;
  socialSecurityNumber: string | null;
  idDocumentNumber: string | null;
  birthDate: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  countryId: string | null;
  iban: string | null;
  currencyId: string | null;
  bankAccountId: string | null;
  notes: string | null;
}

export interface Member_Detail extends Member_Profile {
  id: string;
  user: { id: string; email: string; fullName: string } | null;
  role: { id: string; name: string } | null;
  currency: { id: string; shortCode: string; symbol: string } | null;
}

export type Member_Pay_Kind = 'salary' | 'freelance';

export interface Member_Pay {
  id: string;
  kind: Member_Pay_Kind;
  contractId: string | null;
  description: string | null;
  grossAmount: string;
  paymentsPerYear: number | null;
  payDay: number | null;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  withholdingPct: string | null;
  // Os pagamentos já registados dele
  _count: { payments: number };
}

export interface Member_Pay_Input {
  kind?: Member_Pay_Kind;
  contractId?: string | null;
  description?: string | null;
  grossAmount?: number;
  paymentsPerYear?: number;
  payDay?: number;
  startDate?: string;
  endDate?: string | null;
  dueDate?: string;
  withholdingPct?: number | null;
}

export type Member_Contract_Type = 'permanent' | 'fixed_term' | 'services' | 'internship' | 'other';

export interface Member_Contract {
  id: string;
  type: Member_Contract_Type;
  title: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
}

export interface Member_Contract_Input {
  type?: Member_Contract_Type;
  title?: string | null;
  startDate?: string;
  endDate?: string | null;
  notes?: string | null;
}

export interface Member_Document {
  id: string;
  contractId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/**
 * Um membro com os dados dele e, com `withSalaries` (quem tem `salaries.view`),
 * os salários e recibos verdes, os contratos e os documentos. Cada gravação
 * volta a ler o que mudou e mostra o aviso.
 */
export const useCompanyMember = (
  companyId: string | undefined,
  memberId: string | undefined,
  withSalaries: boolean,
) => {
  const [member, setMember] = useState<Member_Detail | null>(null);
  const [pays, setPays] = useState<Member_Pay[]>([]);
  const [contracts, setContracts] = useState<Member_Contract[]>([]);
  const [documents, setDocuments] = useState<Member_Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const company = companyId ?? '';
  const id = memberId ?? '';
  const fail = (error: unknown) => setAlert({ open: true, message: getErrorMessage(error), type: 'error' });

  const loadMember = () =>
    http
      .get<Member_Detail>(End_Points.Company_Member_Endpoint(company, id))
      .then((response) => setMember(response.data));

  const loadSalaries = () =>
    Promise.all([
      http.get<Member_Pay[]>(End_Points.Company_Member_Pays_Endpoint(company, id)),
      http.get<Member_Contract[]>(End_Points.Company_Member_Contracts_Endpoint(company, id)),
      http.get<Member_Document[]>(End_Points.Company_Member_Documents_Endpoint(company, id)),
    ]).then(([paysResponse, contractsResponse, documentsResponse]) => {
      setPays(paysResponse.data);
      setContracts(contractsResponse.data);
      setDocuments(documentsResponse.data);
    });

  useEffect(() => {
    if (!companyId || !memberId) return;
    Promise.all([loadMember(), withSalaries ? loadSalaries() : null])
      .catch((error) => {
        if (error?.response?.status === 404) setNotFound(true);
        else fail(error);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, memberId, withSalaries]);

  // Grava, volta a ler e avisa; devolve se correu bem
  const mutate = async (request: () => Promise<unknown>, reload: () => Promise<unknown>, successKey: string) => {
    setSaving(true);
    try {
      await request();
      await reload();
      setAlert({ open: true, message: t(successKey), type: 'success' });
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (file: File, contractId: string | null) => {
    const form = new FormData();
    form.append('file', file);
    if (contractId) form.append('contractId', contractId);
    setUploading(true);
    try {
      const response = await http.post<Member_Document>(End_Points.Company_Member_Documents_Endpoint(company, id), form);
      setDocuments((current) => [response.data, ...current]);
      setAlert({ open: true, message: t('documents.uploaded'), type: 'success' });
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      setUploading(false);
    }
  };

  // Passa pela API com o cookie: vem como blob e é o browser que o grava
  const downloadDocument = async (document_: Member_Document) => {
    try {
      const response = await http.get(End_Points.Company_Member_Document_Download_Endpoint(company, id, document_.id), {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = document_.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      fail(error);
    }
  };

  return {
    member,
    pays,
    contracts,
    documents,
    loading,
    notFound,
    saving,
    uploading,
    updateProfile: (profile: Partial<Member_Profile>) =>
      mutate(() => http.patch(End_Points.Company_Member_Endpoint(company, id), profile), loadMember, 'companyMembers.updated'),
    savePay: (payId: string | null, input: Member_Pay_Input) =>
      mutate(
        () =>
          payId
            ? http.patch(End_Points.Company_Member_Pay_Endpoint(company, id, payId), input)
            : http.post(End_Points.Company_Member_Pays_Endpoint(company, id), input),
        loadSalaries,
        'memberPays.saved',
      ),
    deletePay: (payId: string) =>
      mutate(() => http.delete(End_Points.Company_Member_Pay_Endpoint(company, id, payId)), loadSalaries, 'memberPays.deleted'),
    saveContract: (contractId: string | null, input: Member_Contract_Input) =>
      mutate(
        () =>
          contractId
            ? http.patch(End_Points.Company_Member_Contract_Endpoint(company, id, contractId), input)
            : http.post(End_Points.Company_Member_Contracts_Endpoint(company, id), input),
        loadSalaries,
        'memberContracts.saved',
      ),
    deleteContract: (contractId: string) =>
      mutate(
        () => http.delete(End_Points.Company_Member_Contract_Endpoint(company, id, contractId)),
        loadSalaries,
        'memberContracts.deleted',
      ),
    uploadDocument,
    downloadDocument,
    deleteDocument: (documentId: string) =>
      mutate(
        () => http.delete(End_Points.Company_Member_Document_Endpoint(company, id, documentId)),
        loadSalaries,
        'documents.deleted',
      ),
  };
};

export type Company_Member_State = ReturnType<typeof useCompanyMember>;
