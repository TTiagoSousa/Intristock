import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';

interface Calculator {
  id: string;
  name: string;
  abbreviation: string;
  description: string;
  active: boolean;
  simulationsCount: number;
}

export const useCalculators = () => {
  const [calculators, setCalculators] = useState<Calculator[]>([]);
  const [loading, setLoading] = useState(true);

  const { setAlert } = useAlert();

  useEffect(() => {
    const fetchCalculators = async () => {
      try {
        const response = await http.get(End_Points.Calculators_Endpoint());
        setCalculators(response.data);
      } catch (error: any) {
        const msg = error.response?.data?.message || error.message || 'Something went wrong';

        setAlert({ open: true, message: msg, type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchCalculators();
  }, []);

  return { calculators, loading };
};
