import { ValidationItem } from '../types';
import { MOCK_VALIDATION_ITEMS } from './mockData';

let validationState: ValidationItem[] = [...MOCK_VALIDATION_ITEMS];

export async function fetchValidationItems(): Promise<ValidationItem[]> {
  return validationState;
}

export async function markItemValidated(id: string, resolutionNote?: string): Promise<ValidationItem[]> {
  validationState = validationState.map(item => 
    item.id === id ? { ...item, status: 'resolved' as const, resolutionNote: resolutionNote || 'Validated by user auditor' } : item
  );
  return validationState;
}
