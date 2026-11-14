import { useTranslation } from 'react-i18next';
import type { CompanyPermission, CompanyPermissionArea } from '../../../../Hooks/Companies/companyPermissions';

// A ordem das colunas; cada área só tem as ações que fazem sentido nela
const ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'manage'];

interface Permission_Grid_Props {
  catalog: CompanyPermissionArea[];
  // As permissões marcadas (num membro, as que fica a ter no fim)
  value: CompanyPermission[];
  onChange: (next: CompanyPermission[]) => void;
  // Num membro, as do cargo: o que difere delas aparece como "a mais" ou "tirada"
  base?: CompanyPermission[];
  disabled?: boolean;
}

/**
 * As permissões numa grelha: uma linha por área, uma coluna por ação. Marcar
 * uma ação marca o "ver" da área (não se cria o que não se vê) e desmarcar o
 * "ver" desmarca a área toda.
 */
const Permission_Grid = ({ catalog, value, onChange, base, disabled }: Permission_Grid_Props) => {
  const { t } = useTranslation();
  const checked = new Set<string>(value);
  const actions = ACTION_ORDER.filter((action) => catalog.some((area) => area.actions.includes(action)));

  const toggle = (area: string, action: string) => {
    const permission = `${area}.${action}` as CompanyPermission;
    const next = new Set(checked);
    if (next.has(permission)) {
      next.delete(permission);
      if (action === 'view') {
        catalog.find((a) => a.area === area)?.actions.forEach((a) => next.delete(`${area}.${a}`));
      }
    } else {
      next.add(permission);
      next.add(`${area}.view`);
    }
    onChange([...next] as CompanyPermission[]);
  };

  // Clicar no nome da área marca-a toda, ou desmarca-a se já estava toda
  const toggleArea = (area: CompanyPermissionArea) => {
    const all = area.actions.every((action) => checked.has(`${area.area}.${action}`));
    const next = new Set(checked);
    area.actions.forEach((action) => (all ? next.delete(`${area.area}.${action}`) : next.add(`${area.area}.${action}`)));
    onChange([...next] as CompanyPermission[]);
  };

  const stateOf = (permission: string) => {
    if (!base) return '';
    const inBase = base.includes(permission as CompanyPermission);
    if (checked.has(permission) && !inBase) return 'Extra';
    if (!checked.has(permission) && inBase) return 'Denied';
    return '';
  };

  return (
    <div className="Table_Wrap">
      <table className="Table Permission_Grid">
        <thead>
          <tr>
            <th>{t('companyRoles.area')}</th>
            {actions.map((action) => (
              <th key={action} className="Center">
                {t(`companyRoles.actions.${action}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalog.map((area) => (
            <tr key={area.area}>
              <td>
                <button
                  type="button"
                  className="Permission_Area"
                  onClick={() => toggleArea(area)}
                  disabled={disabled}
                >
                  {t(`companyRoles.areas.${area.area}`)}
                </button>
              </td>
              {actions.map((action) => {
                const permission = `${area.area}.${action}`;
                if (!area.actions.includes(action)) return <td key={action} />;
                const state = stateOf(permission);
                return (
                  <td key={action} className={`Center Permission_Cell ${state}`}>
                    <input
                      type="checkbox"
                      checked={checked.has(permission)}
                      onChange={() => toggle(area.area, action)}
                      disabled={disabled}
                      aria-label={`${t(`companyRoles.areas.${area.area}`)} · ${t(`companyRoles.actions.${action}`)}`}
                    />
                    {state && <span className="Permission_Mark">{state === 'Extra' ? '+' : '−'}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Permission_Grid;
