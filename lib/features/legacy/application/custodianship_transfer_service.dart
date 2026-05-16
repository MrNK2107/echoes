import 'package:echoes/features/legacy/domain/legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';
import 'package:echoes/features/places/domain/place_repository.dart';

class CustodianshipTransferService {
  const CustodianshipTransferService({
    required LegacyTransferRepository transferRepository,
    required PlaceRepository placeRepository,
  }) : _transferRepository = transferRepository,
       _placeRepository = placeRepository;

  final LegacyTransferRepository _transferRepository;
  final PlaceRepository _placeRepository;

  Future<void> acceptTransfer(String transferId) async {
    final transfer = await _transferRepository.findById(transferId);
    if (transfer == null || transfer.status != TransferStatus.pending) {
      return;
    }

    final place = await _placeRepository.findById(transfer.placeId);
    if (place != null && !place.custodianIds.contains(transfer.toUserId)) {
      await _placeRepository.save(
        place.copyWith(
          custodianIds: [...place.custodianIds, transfer.toUserId],
          updatedAt: DateTime.now().toUtc(),
        ),
      );
    }

    await _transferRepository.accept(transferId);
  }
}
