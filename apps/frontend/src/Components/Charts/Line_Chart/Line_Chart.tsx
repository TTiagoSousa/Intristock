import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import './Line_Chart.scss';

export interface LineSeries {
  dataKey: string;
  name: string;
  color: string;
  dashed?: boolean;
}

interface LineDataPoint {
  period: number | string;
  [key: string]: number | string;
}

interface TooltipPayload {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  formatValue?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, formatValue }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="LC_Tooltip">
      <span className="LC_Tooltip_Label">{label}</span>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="LC_Tooltip_Row">
          <span className="LC_Tooltip_Dot" style={{ backgroundColor: entry.color }} />
          <span className="LC_Tooltip_Name">{entry.name}</span>
          <span className="LC_Tooltip_Value">{formatValue ? formatValue(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

interface Props {
  title: string;
  subtitle?: string;
  data: LineDataPoint[];
  series: LineSeries[];
  formatValue?: (value: number) => string;
}

const Line_Chart = ({ title, subtitle, data, series, formatValue }: Props) => {
  return (
    <div className="Line_Chart">
      <div className="Line_Chart_Header">
        <span className="Line_Chart_Title">{title}</span>
        {subtitle && <span className="Line_Chart_Subtitle">{subtitle}</span>}
      </div>
      <div className="Line_Chart_Body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -15 }}>
            <CartesianGrid vertical={false} stroke="var(--cards-base-letter-color)" strokeOpacity={0.15} strokeDasharray="4 4" />
            <XAxis
              dataKey="period"
              tick={{ fill: 'var(--cards-base-letter-color)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--cards-base-letter-color)', strokeOpacity: 0.2 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--cards-base-letter-color)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip formatValue={formatValue} />}
              cursor={{ stroke: 'var(--cards-base-letter-color)', strokeOpacity: 0.2 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Line_Chart;
