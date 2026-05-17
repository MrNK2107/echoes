import 'package:echoes/app/theme.dart';
import 'package:echoes/core/media/local_image_cache.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class MemoryImagePreview extends StatelessWidget {
  const MemoryImagePreview({
    required this.imageUrl,
    this.height = 160,
    this.borderRadius = 8,
    super.key,
  });

  final String imageUrl;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final cache = context.read<LocalImageCache>();

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Image(
        key: ValueKey('memoryImagePreview-$imageUrl'),
        image: cache.providerFor(imageUrl),
        height: height,
        width: double.infinity,
        fit: BoxFit.cover,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) {
            return child;
          }
          return _ImageStateFrame(
            height: height,
            icon: Icons.image_outlined,
            child: LinearProgressIndicator(
              value: loadingProgress.expectedTotalBytes == null
                  ? null
                  : loadingProgress.cumulativeBytesLoaded /
                        loadingProgress.expectedTotalBytes!,
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) {
          return _ImageStateFrame(
            height: height,
            icon: Icons.broken_image_outlined,
            child: Text(
              imageUrl,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ImageStateFrame extends StatelessWidget {
  const _ImageStateFrame({
    required this.height,
    required this.icon,
    required this.child,
  });

  final double height;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: EchoesColors.elevatedSurface,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: EchoesColors.textSecondary),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
