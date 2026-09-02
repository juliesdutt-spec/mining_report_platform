import { TopicEntity } from '../types';
import { MOCK_TOPICS } from './mockData';

export async function fetchTopics(): Promise<TopicEntity[]> {
  return MOCK_TOPICS;
}
