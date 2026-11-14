import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage, useAsyncRequest } from '../useAsyncRequest';

export interface CompanyPaymentDocument {
  id: string;
  paymentId: string;
  fileName: string;
  mimeType: string;
  // Bytes
  size: number;
  createdAt: string;
}

/**
 * Envia um ficheiro para um pagamento. Vive fora do hook porque o formulário
 * de criação também precisa dela — e aí o pagamento ainda não existe quando o
 * hook teria de ser montado.
 */
export const uploadPaymentDocument = async (
  companyId: string,
  paymentId: string,
  file: File,
): Promise<CompanyPaymentDocument> => {
  const form = new FormData();
  form.append('file', file);

  const response = await http.post(
    End_Points.Company_Payment_Documents_Endpoint(companyId, paymentId),
    form,
  );

  return response.data;
};

export const useCompanyPaymentDocuments = (
  companyId: string | undefined,
  paymentId: string | undefined,
) => {
  const [documents, setDocuments] = useState<CompanyPaymentDocument[]>([]);
  // Separado do loading da lista: o upload não deve fazer a lista desaparecer
  const [uploading, setUploading] = useState(false);

  const { loading, run } = useAsyncRequest(true);
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const fetchDocuments = async () => {
    if (!companyId || !paymentId) return;

    const response = await run(() =>
      http.get(End_Points.Company_Payment_Documents_Endpoint(companyId, paymentId)),
    );

    if (response) setDocuments(response.data);
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, paymentId]);

  const uploadDocument = async (file: File) => {
    if (!companyId || !paymentId) return false;

    setUploading(true);

    try {
      const document = await uploadPaymentDocument(companyId, paymentId, file);

      setDocuments((current) => [document, ...current]);
      setAlert({ open: true, message: t('documents.uploaded'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!companyId || !paymentId) return false;

    try {
      await http.delete(
        End_Points.Company_Payment_Document_Endpoint(companyId, paymentId, documentId),
      );

      setDocuments((current) => current.filter((document) => document.id !== documentId));
      setAlert({ open: true, message: t('documents.deleted'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      return false;
    }
  };

  /**
   * O download passa pela API com o cookie de sessão, por isso não se pode
   * abrir o URL numa janela nova — vem como blob e é o browser que o grava.
   */
  const downloadDocument = async (document_: CompanyPaymentDocument) => {
    if (!companyId || !paymentId) return;

    try {
      const response = await http.get(
        End_Points.Company_Payment_Document_Download_Endpoint(companyId, paymentId, document_.id),
        { responseType: 'blob' },
      );

      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');

      link.href = url;
      link.download = document_.fileName;
      link.click();

      // Sem isto o blob fica em memória até a página ser recarregada
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
    }
  };

  return {
    documents,
    loading,
    uploading,
    refresh: fetchDocuments,
    uploadDocument,
    deleteDocument,
    downloadDocument,
  };
};
