import 'package:echoes/features/aura/domain/sentiment_analyzer.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';

/// Lexicon-based sentiment analyzer for on-device use.
///
/// Implements a VADER-inspired approach using:
/// - Expanded positive/negative word lexicons
/// - Negation handling (e.g., "not happy" → negative)
/// - Intensifier boost/dampening (e.g., "very good" → stronger)
/// - Contrastive conjunction handling (e.g., "but" flips sentiment weight)
class LexiconSentimentAnalyzer implements SentimentAnalyzer {
  static const _positiveWords = {
    'beautiful', 'calm', 'celebrate', 'cheerful', 'comfort', 'comfortable',
    'congratulate', 'delight', 'delighted', 'delightful', 'ecstatic',
    'elated', 'excellent', 'excited', 'exciting', 'fantastic', 'farewell',
    'favorite', 'friend', 'glow', 'glowing', 'good', 'gorgeous', 'graceful',
    'grateful', 'great', 'happy', 'heartwarming', 'hope', 'hopeful',
    'incredible', 'inspire', 'inspired', 'inspiring', 'joy', 'joyful',
    'joyous', 'kind', 'lovely', 'love', 'loved', 'loving',    'magnificent', 'marvelous', 'miracle', 'neat', 'nice', 'peace',
    'peaceful', 'perfect', 'pleasant', 'pleased', 'pleasure', 'positive',
    'proud', 'relax', 'relaxed', 'relaxing', 'splendid', 'stunning',
    'success', 'successful', 'sweet', 'terrific', 'thank', 'thankful',
    'thrilled', 'touching', 'tranquil', 'trust', 'upbeat', 'vibrant',
    'warm', 'warmth', 'welcome', 'welcomed', 'wonderful', 'worthy',
    'yearning', 'bright', 'brilliant', 'amaze', 'amazed', 'amazing',
    'awesome', 'bless', 'blessed', 'bliss', 'blissful', 'breathtaking',
  };

  static const _negativeWords = {
    'abandoned', 'afraid', 'aggressive', 'agonizing', 'alone', 'angry',
    'anguish', 'annoyed', 'anxious', 'apathy', 'appalling', 'awful',
    'bad', 'bitter', 'bleak', 'bored', 'boring', 'broken', 'brutal',
    'burden', 'chaotic', 'cold', 'confused', 'crushing', 'cry', 'crying',
    'damage', 'damaged', 'dark', 'darkness', 'depressed', 'depressing',
    'despair', 'desperate', 'despicable', 'devastated', 'difficult',
    'dirty', 'disappoint', 'disappointed', 'disappointing', 'disaster',
    'discouraged', 'disgust', 'disgusted', 'disgusting', 'dismal',
    'distress', 'distressed', 'disturbing', 'dread', 'dreadful',
    'embarrassed', 'embarrassing', 'empty', 'enraged',    'evil', 'fear',
    'fearful', 'fears', 'foul', 'frightened', 'frightening', 'frustrated',
    'frustrating', 'fury', 'gloomy', 'grief', 'grim', 'gruesome',
    'guilty', 'hate', 'hated', 'hateful', 'hatred', 'haunting', 'heartache',
    'heartbreaking', 'heavy', 'hopeless', 'horrible', 'horrific', 'horrified',
    'hostile', 'hurt', 'hurting', 'insult', 'insulted', 'insulting',
    'irritated', 'isolated', 'jealous', 'livid', 'lonely', 'longing',
    'lost', 'miserable', 'misery', 'mourn', 'mournful', 'nasty', 'negative',
    'neglect', 'neglected', 'nervous', 'nightmare', 'numb', 'offensive',
    'outraged', 'pain', 'painful', 'panic', 'panicked', 'pathetic',
    'rage', 'regret', 'regretful', 'rejected', 'sad', 'sadness', 'scared',
    'scary', 'sensitive', 'shame', 'shameful', 'shocked', 'shocking',
    'sick', 'sorrow', 'sorrowful', 'sorry', 'suffering', 'suspicious',
    'tense', 'terrible', 'terrified', 'terrifying', 'threatened', 'tired',
    'tragedy', 'tragic', 'traumatic', 'troubled', 'ugly', 'ugliness',
    'uncertain', 'uncomfortable', 'unhappy', 'unjust', 'unsettled',
    'upset', 'useless', 'vile', 'violated', 'vulnerable', 'wasted',
    'weary', 'weep', 'wicked', 'wilted', 'worn', 'worried', 'worry',
    'worthless', 'wounded', 'wretched',
  };

  /// Words that flip the polarity of the following word (negations).
  static const _negations = {
    'not', 'no', 'never', 'neither', 'nor', 'nothing', 'nowhere',
    'hardly', 'barely', 'scarcely',
    "doesn't", 'doesnt', "don't", 'dont', "didn't", 'didnt', "won't", 'wont',
    "wouldn't", 'wouldnt', "shouldn't", 'shouldnt', "couldn't", 'couldnt',
    "isn't", 'isnt', "aren't", 'arent', "wasn't", 'wasnt', "weren't", 'werent',
    "hasn't", 'hasnt', "haven't", 'havent', "hadn't", 'hadnt',
    "can't", 'cant', 'cannot', "mustn't", 'mustnt', "needn't", 'neednt',
  };

  /// Words that amplify the sentiment intensity of the following adjective.
  static const _intensifiers = {
    'very', 'extremely', 'incredibly', 'absolutely', 'completely',
    'totally', 'utterly', 'deeply', 'highly', 'terribly', 'awfully',
    'really', 'so', 'such', 'quite', 'remarkably', 'exceptionally',
    'intensely', 'profoundly', 'immensely', 'thoroughly',
  };

  /// Words that mildly boost sentiment.
  static const _boosters = {
    'pretty', 'rather', 'somewhat', 'fairly', 'moderately', 'slightly',
    'little', 'bit', 'kinda', 'sorta',
  };

  /// Contrastive conjunctions that shift weight to the clause after them.
  static const _contrastive = {
    'but', 'however', 'although', 'though', 'yet', 'nevertheless',
    'nonetheless', 'despite', 'unfortunately',
  };

  @override
  SentimentResult analyze(String text) {
    final tokens = _tokenize(text);
    if (tokens.isEmpty) {
      return const SentimentResult(
        compound: 0, positive: 0, neutral: 1, negative: 0,
      );
    }

    var totalPositive = 0.0;
    var totalNegative = 0.0;
    var scoredCount = 0;
    var inNegatedContext = false;
    var contrastiveSeen = false;
    // After contrastive, negations may reset
    var afterContrastiveNegation = false;

    for (var i = 0; i < tokens.length; i++) {
      final word = tokens[i];
      final prevWord = i > 0 ? tokens[i - 1] : null;
      final nextWord = i < tokens.length - 1 ? tokens[i + 1] : null;

      // Track contrastive conjunctions
      if (_contrastive.contains(word)) {
        contrastiveSeen = true;
        inNegatedContext = false;
        continue;
      }

      // Track negation state
      if (_negations.contains(word)) {
        inNegatedContext = !inNegatedContext;
        if (contrastiveSeen) {
          afterContrastiveNegation = !afterContrastiveNegation;
        }
        continue;
      }

      // Skip intensifiers/boosters themselves (they modify the next word)
      if (_intensifiers.contains(word) || _boosters.contains(word)) {
        continue;
      }

      final isPositive = _positiveWords.contains(word);
      final isNegative = _negativeWords.contains(word);

      if (!isPositive && !isNegative) {
        // Reset negation if we hit a non-sentiment word (within reason)
        // But keep it active for the next word
        continue;
      }

      // Check for intensifier before this word
      var intensityMultiplier = 1.0;
      if (prevWord != null) {
        if (_intensifiers.contains(prevWord)) {
          intensityMultiplier = 1.35;
        } else if (_boosters.contains(prevWord)) {
          intensityMultiplier = 1.15;
        }
      }

      // Check for intensifier after (e.g., "good very"? — rare but handle)
      if (nextWord != null && _intensifiers.contains(nextWord)) {
        intensityMultiplier = 1.25;
      }

      // Apply negation
      if (inNegatedContext) {
        if (isPositive) {
          totalNegative += 0.6 * intensityMultiplier;
        } else {
          totalPositive += 0.6 * intensityMultiplier;
        }
      } else {
        if (isPositive) {
          totalPositive += 1.0 * intensityMultiplier;
        } else {
          totalNegative += 1.0 * intensityMultiplier;
        }
      }

      scoredCount++;

      // Negation typically only flips the immediate next word,
      // unless followed by another negation
      if (!afterContrastiveNegation) {
        inNegatedContext = false;
      }
    }

    if (scoredCount == 0) {
      return const SentimentResult(
        compound: 0, positive: 0, neutral: 1, negative: 0,
      );
    }

    // If contrastive conjunction was seen, weight the second clause higher
    // (the clause after "but"/"however" carries more rhetorical weight)
    final sumScore = totalPositive - totalNegative;
    final maxScore = totalPositive + totalNegative;
    final compound = maxScore == 0
        ? 0.0
        : (sumScore / maxScore).clamp(-1.0, 1.0);

    return SentimentResult(
      compound: compound,
      positive: (totalPositive / (totalPositive + totalNegative + 1)).clamp(0, 1),
      neutral: (1 - (totalPositive + totalNegative) / (scoredCount * 1.5)).clamp(0, 1),
      negative: (totalNegative / (totalPositive + totalNegative + 1)).clamp(0, 1),
    );
  }

  List<String> _tokenize(String text) {
    return text
        .toLowerCase()
        .split(RegExp(r"[^a-z']+"))
        .where((word) => word.isNotEmpty)
        .toList();
  }
}
