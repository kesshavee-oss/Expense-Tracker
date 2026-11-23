import type React from 'react';
import type { ImportProfile, PlannedImportItem } from '../utils/csvImport';

export interface ImportScreenProps {
  onBack: () => void;
  existingImportKeys: string[];
  importProfiles: ImportProfile[];
  onSaveProfile: (profile: ImportProfile) => void;
  onDeleteProfile: (id: string) => void;
  onCommitImport: (items: PlannedImportItem[]) => boolean;
}

export declare const ImportScreen: React.FC<ImportScreenProps>;
