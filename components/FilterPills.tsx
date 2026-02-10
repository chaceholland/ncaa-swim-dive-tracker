'use client';

import { cn } from '@/lib/utils';
import Badge from '@/components/ui/Badge';

export type ViewMode = 'rosters' | 'teams';
export type Conference = 'all' | 'sec' | 'big-ten' | 'acc' | 'big-12' | 'ivy' | 'other';
export type AthleteType = 'all' | 'swimmers' | 'divers';

export interface FilterCounts {
  viewMode: {
    rosters: number;
    teams: number;
  };
  conference: {
    all: number;
    sec: number;
    'big-ten': number;
    acc: number;
    'big-12': number;
    ivy: number;
    other: number;
  };
  athleteType: {
    all: number;
    swimmers: number;
    divers: number;
  };
}

export interface FilterPillsProps {
  viewMode: ViewMode;
  conference: Conference;
  athleteType: AthleteType;
  counts: FilterCounts;
  onViewModeChange: (mode: ViewMode) => void;
  onConferenceChange: (conference: Conference) => void;
  onAthleteTypeChange: (type: AthleteType) => void;
}

interface PillProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

/**
 * Individual pill component with active/inactive states
 */
function Pill({ label, count, active, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200',
        'font-medium text-sm whitespace-nowrap',
        active
          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
      )}
    >
      <span>{label}</span>
      <Badge
        variant="default"
        className={cn(
          active
            ? 'bg-white/20 text-white border-white/30'
            : 'bg-slate-200 text-slate-600 border-slate-300'
        )}
      >
        {count}
      </Badge>
    </button>
  );
}

/**
 * FilterPills component with three filter groups
 * Features view mode toggle, conference filters, and athlete type filters
 */
export default function FilterPills({
  viewMode,
  conference,
  athleteType,
  counts,
  onViewModeChange,
  onConferenceChange,
  onAthleteTypeChange,
}: FilterPillsProps) {
  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-8 py-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* View Mode Filter */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            View Mode
          </h3>
          <div className="flex gap-2">
            <Pill
              label="Rosters"
              count={counts.viewMode.rosters}
              active={viewMode === 'rosters'}
              onClick={() => onViewModeChange('rosters')}
            />
            <Pill
              label="Teams"
              count={counts.viewMode.teams}
              active={viewMode === 'teams'}
              onClick={() => onViewModeChange('teams')}
            />
          </div>
        </div>

        {/* Conference Filter */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Conference
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <Pill
              label="All"
              count={counts.conference.all}
              active={conference === 'all'}
              onClick={() => onConferenceChange('all')}
            />
            <Pill
              label="SEC"
              count={counts.conference.sec}
              active={conference === 'sec'}
              onClick={() => onConferenceChange('sec')}
            />
            <Pill
              label="Big Ten"
              count={counts.conference['big-ten']}
              active={conference === 'big-ten'}
              onClick={() => onConferenceChange('big-ten')}
            />
            <Pill
              label="ACC"
              count={counts.conference.acc}
              active={conference === 'acc'}
              onClick={() => onConferenceChange('acc')}
            />
            <Pill
              label="Big 12"
              count={counts.conference['big-12']}
              active={conference === 'big-12'}
              onClick={() => onConferenceChange('big-12')}
            />
            <Pill
              label="Ivy"
              count={counts.conference.ivy}
              active={conference === 'ivy'}
              onClick={() => onConferenceChange('ivy')}
            />
            <Pill
              label="Other"
              count={counts.conference.other}
              active={conference === 'other'}
              onClick={() => onConferenceChange('other')}
            />
          </div>
        </div>

        {/* Athlete Type Filter */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Athlete Type
          </h3>
          <div className="flex gap-2">
            <Pill
              label="All Athletes"
              count={counts.athleteType.all}
              active={athleteType === 'all'}
              onClick={() => onAthleteTypeChange('all')}
            />
            <Pill
              label="Swimmers"
              count={counts.athleteType.swimmers}
              active={athleteType === 'swimmers'}
              onClick={() => onAthleteTypeChange('swimmers')}
            />
            <Pill
              label="Divers"
              count={counts.athleteType.divers}
              active={athleteType === 'divers'}
              onClick={() => onAthleteTypeChange('divers')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
