import UnifiedQuiz from './UnifiedQuiz'

export default function GameEngine({ activity, onComplete }) {
  return <UnifiedQuiz activity={activity} onComplete={onComplete} />
}
