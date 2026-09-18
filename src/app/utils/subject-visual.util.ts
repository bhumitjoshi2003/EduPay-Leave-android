/**
 * The single source of truth for "what emoji/accent colour represents this subject" —
 * extracted from TimetableComponent (getSubjectIcon/getSubjectClass) so any other surface
 * showing subjects (e.g. the teacher dashboard's Today's Classes) reuses the exact same
 * data-driven mapping instead of inventing a second one that can drift out of sync.
 */

export function subjectIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('physics'))                                               return '⚛️';
  if (n.includes('chemistry'))                                             return '🧪';
  if (n.includes('biology'))                                               return '🧬';
  if (n.includes('math'))                                                  return '🔢';
  if (n.includes('english'))                                               return '📖';
  if (n.includes('hindi'))                                                 return '📝';
  if (n.includes('sanskrit') || n.includes('third language'))             return '🕉️';
  if (n.includes('computer science') || n.includes('informatics'))        return '💻';
  if (n.includes('information technology') || n === 'it'
    || n.includes('artificial intelligence') || n.includes(' ai'))        return '🖥️';
  if (n.includes('drawing') || n.includes('art'))                         return '🎨';
  if (n.includes('music'))                                                 return '🎵';
  if (n.includes('physical education') || n === 'pt' || n === 'pe'
    || n.includes('sport'))                                                return '⚽';
  if (n.includes('evs') || n.includes('environmental'))                   return '🌱';
  if (n.includes('general knowledge') || n === 'gk')                      return '💡';
  if (n.includes('computer'))                                              return '💻';
  if (n.includes('science'))                                               return '🔬';
  if (n.includes('social science') || n === 'sst')                        return '🌍';
  if (n.includes('history'))                                               return '📜';
  if (n.includes('geography'))                                             return '🗺️';
  if (n.includes('political science') || n.includes('civics'))            return '⚖️';
  if (n.includes('economics'))                                             return '📈';
  if (n.includes('accountancy') || n.includes('accounting'))              return '📊';
  if (n.includes('business'))                                              return '💼';
  if (n.includes('sociology'))                                             return '👥';
  if (n.includes('psychology'))                                            return '🧠';
  return '📚';
}

export function subjectAccentClass(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('physics'))                                               return 'physics';
  if (n.includes('chemistry'))                                             return 'chemistry';
  if (n.includes('biology'))                                               return 'biology';
  if (n.includes('math'))                                                  return 'maths';
  if (n.includes('english'))                                               return 'english';
  if (n.includes('hindi'))                                                 return 'hindi';
  if (n.includes('sanskrit') || n.includes('third language'))             return 'sanskrit';
  if (n.includes('computer') || n.includes('informatics')
    || n.includes('information technology')
    || n.includes('artificial intelligence'))                              return 'computer';
  if (n.includes('drawing') || n.includes('art') || n.includes('music')) return 'arts';
  if (n.includes('physical education') || n === 'pt' || n === 'pe'
    || n.includes('sport'))                                                return 'pe';
  if (n.includes('evs') || n.includes('environmental')
    || n.includes('science'))                                              return 'science';
  if (n.includes('social science') || n === 'sst' || n.includes('history')
    || n.includes('geography') || n.includes('civics')
    || n.includes('political'))                                            return 'sst';
  if (n.includes('general knowledge') || n === 'gk')                      return 'gk';
  if (n.includes('economics'))                                             return 'economics';
  if (n.includes('accountancy') || n.includes('accounting'))              return 'accountancy';
  if (n.includes('business'))                                              return 'business';
  if (n.includes('sociology') || n.includes('psychology'))                return 'social';
  return 'default';
}
